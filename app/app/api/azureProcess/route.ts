// app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";

const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

// --- Prompts por asignatura ---
const promptsExpertos: Record<string, string> = {
  general: `Actúa como un profesor universitario detallista, riguroso y constructivo.`,
  matematicas: `Actúa como un catedrático de Matemáticas. Sé riguroso y lógico. Explica paso a paso.`,
  lenguaje: `Actúa como crítico literario. Evalúa coherencia, tesis y estructura citando el texto.`,
  ciencias: `Actúa como científico e investigador. Evalúa método científico y correcta interpretación de datos.`,
  artes: `Actúa como curador de arte profesional. Describe elementos visuales para justificar análisis y retroalimentación.`,
  humanidades: `Actúa como filósofo académico. Evalúa pensamiento crítico y claridad de argumentación.`,
  ingles: `Actúa como examinador C2. Evalúa gramática, vocabulario y fluidez, citando errores específicos.`,
};

// --- Función OCR usando Azure Computer Vision ---
async function ocrAzure(imageBuffer: Buffer): Promise<string> {
  const credentials = new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY } });
  const client = new ComputerVisionClient(credentials, AZURE_VISION_ENDPOINT);
  const result = await client.readInStream(imageBuffer);
  const operationId = result.operationLocation.split("/").pop()!;
  
  let analysisResult;
  do {
    await new Promise(resolve => setTimeout(resolve, 1000));
    analysisResult = await client.getReadResult(operationId);
  } while (analysisResult.status === "running" || analysisResult.status === "notStarted");

  let fullText = "";
  if (analysisResult.status === "succeeded" && analysisResult.analyzeResult) {
    for (const page of analysisResult.analyzeResult.readResults) {
      for (const line of page.lines) {
        fullText += line.text + "\n";
      }
    }
  }
  return fullText;
}

// --- Llamada a Mistral API ---
async function callMistralAPI(payload: any) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${MISTRAL_API_KEY}` 
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Error en Mistral: ${response.statusText}`);
  return response.json();
}

// --- Route POST principal ---
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { fileUrls, rubrica, pauta, areaConocimiento } = payload;

    if (!fileUrls || fileUrls.length === 0)
      throw new Error("No se proporcionaron archivos para evaluación.");

    // --- OCR de todas las imágenes ---
    let textoCompleto = "";
    for (const url of fileUrls) {
      const base64Data = url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      textoCompleto += await ocrAzure(buffer) + "\n\n";
    }

    const personalidadExperto = promptsExpertos[areaConocimiento] || promptsExpertos.general;

    // --- Prompt maestro final ---
    const promptFinal = `
${personalidadExperto}

Tu tarea es evaluar este trabajo como un experto siguiendo la rúbrica proporcionada.
Piensa paso a paso y entrega un JSON válido con:
- nota (1.0-7.0)
- puntaje
- retroalimentacion: { correccion_detallada, evaluacion_habilidades, resumen_general }

TEXTO DEL ESTUDIANTE: """${textoCompleto}"""
RÚBRICA: """${rubrica}"""
PAUTA (si aplica): """${pauta}"""
`;

    // --- Llamada a Mistral ---
    const aiResponse = await callMistralAPI({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: promptFinal }],
      response_format: { type: "json_object" },
    });

    const content = aiResponse.choices[0].message.content;
    let resultado = JSON.parse(content);

    // --- Guardias de calidad ---
    let notaNumerica = parseFloat(resultado.nota);
    if (isNaN(notaNumerica) || notaNumerica < 1.0) notaNumerica = 1.0;
    else if (notaNumerica > 7.0) notaNumerica = 7.0;
    resultado.nota = notaNumerica;
    resultado.puntaje = String(resultado.puntaje || "N/A");

    resultado.retroalimentacion = resultado.retroalimentacion || {};
    if (!Array.isArray(resultado.retroalimentacion.correccion_detallada))
      resultado.retroalimentacion.correccion_detallada = [];
    if (!Array.isArray(resultado.retroalimentacion.evaluacion_habilidades))
      resultado.retroalimentacion.evaluacion_habilidades = [];
    resultado.retroalimentacion.resumen_general =
      resultado.retroalimentacion.resumen_general || { fortalezas: "No especificado.", areas_mejora: "No especificado." };

    return NextResponse.json({ success: true, ...resultado });

  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
