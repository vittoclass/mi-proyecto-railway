import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";

// Tomamos variables de entorno
const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!;

if (!endpoint || !apiKey) {
  throw new Error("Faltan las variables de entorno de Azure Document Intelligence");
}

const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

export const processAzureImage = async (file: Blob | Buffer) => {
  try {
    let fileBuffer: Uint8Array;

    // ==================================================================
    // INICIO DE LA CORRECCIÓN
    // Verificamos explícitamente si 'file' es un Buffer o un Blob (File es un tipo de Blob)
    // para que TypeScript entienda el tipo correcto en cada bloque.
    // ==================================================================
    if (file instanceof Buffer) {
      // Si ya es un Buffer, lo usamos directamente.
      fileBuffer = new Uint8Array(file);
    } else if (file instanceof Blob) {
      // Si es un Blob o un File, usamos arrayBuffer() para convertirlo.
      fileBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
        // Caso de seguridad por si el tipo de archivo no es soportado.
        throw new Error("Tipo de archivo no soportado para el análisis de Azure.");
    }
    // ==================================================================
    // FIN DE LA CORRECCIÓN
    // ==================================================================

    // Analizar documento
    const poller = await client.beginAnalyzeDocument("prebuilt-document", fileBuffer);
    const result = await poller.pollUntilDone();

    const text = result?.content ?? "";
    return { success: true, text, raw: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

