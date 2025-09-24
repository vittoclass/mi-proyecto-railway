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

    // Convertir Blob o Buffer a Uint8Array
    if (file instanceof Buffer) {
      fileBuffer = new Uint8Array(file);
    } else {
      fileBuffer = new Uint8Array(await file.arrayBuffer());
    }

    // Analizar documento
    const poller = await client.beginAnalyzeDocument("prebuilt-document", fileBuffer);
    const result = await poller.pollUntilDone();

    const text = result?.content ?? "";
    return { success: true, text, raw: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
