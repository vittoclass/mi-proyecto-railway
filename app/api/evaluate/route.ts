import { type NextRequest, NextResponse } from "next/server"

// --- INTERFACES Y FUNCIONES AUXILIARES ---
interface EvaluationConfig {
  sistema: string; nivelExigencia: number; puntajeMaximo: number; notaAprobacion: number; flexibility: number; fecha: string; nombrePrueba: string; curso: string; rubrica: string; preguntasObjetivas: string; aiModel: string;
}
function calculateFinalGrade(puntajeObtenido: number, puntajeMax: number, sistema: string, exigencia: number, notaAprobacion: number) {
  if (puntajeMax <= 0) return sistema === "chile_2_7" ? 2.0 : 0;
  const porcentaje = puntajeObtenido / puntajeMax;
  if (sistema === "chile_2_7") {
    const pExigencia = exigencia / 100; const notaMax = 7.0; const notaMin = 2.0; let nota;
    if (porcentaje >= pExigencia) { nota = notaAprobacion + (notaMax - notaAprobacion) * ((porcentaje - pExigencia) / (1 - pExigencia)); } 
    else { nota = notaMin + (notaAprobacion - notaMin) * (porcentaje / pExigencia); }
    return Math.min(notaMax, Math.max(notaMin, Math.round(nota * 10) / 10));
  } else if (sistema === "latam_1_10") { return Math.min(10.0, 1.0 + 9.0 * porcentaje); } 
  else if (sistema === "porcentual_0_100") { return Math.min(100.0, 100.0 * porcentaje); }
  return 0;
}
async function callMistralAPI(payload: any) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY no está configurada.");
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Mistral API error: ${data.error?.message || response.statusText}`);
  return data;
}
async function ocrAzure(file: Buffer) {
  const azureKey = process.env.AZURE_VISION_KEY;
  const azureEndpoint = process.env.AZURE_VISION_ENDPOINT;
  if (!azureKey || !azureEndpoint) throw new Error("AZURE_VISION_KEY o AZURE_VISION_ENDPOINT no están configuradas.");
  const response = await fetch(`${azureEndpoint}vision/v3.2/ocr?language=es`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": azureKey, "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`Azure OCR error: ${response.statusText}`);
  const data = await response.json();
  return data.regions?.flatMap((reg: any) => reg.lines.map((l: any) => l.words.map((w: any) => w.text).join(" "))).join("\n") || "";
}

// --- FUNCIÓN DE EXTRACCIÓN DE NOMBRES MEJORADA ---
async function extractNameWithAI(text: string) {
  if (!text.trim()) return ""
  const prompt = `### MISIÓN: EXTRAER NOMBRE DE ESTUDIANTE ###
Eres un asistente de IA especializado en identificar nombres de estudiantes en documentos escolares transcritos.

### REGLAS ESTRICTAS ###
1.  **Prioriza Pistas Clave:** Busca etiquetas explícitas como "Nombre:", "Alumno/a:", "Estudiante:". El texto que sigue a estas etiquetas es casi siempre el correcto.
2.  **Ignora Nombres de Instituciones:** Nombres como "Liceo", "Colegio", "Escuela" o "Instituto" NO son nombres de estudiantes. Ignóralos.
3.  **Ignora Otro Texto:** Asignaturas, fechas, nombres de profesores y títulos de trabajos NO son el nombre del estudiante.
4.  **Respuesta Limpia:** Tu respuesta debe ser ÚNICA Y EXCLUSIVAMENTE el nombre completo del estudiante. No incluyas explicaciones, saludos ni la palabra "Nombre:".
5.  **En Caso de Duda:** Si no encuentras un nombre que claramente pertenezca a un estudiante, responde con una cadena vacía ("").

### DOCUMENTO TRANSCRITO ###
"""${text}"""

### NOMBRE DEL ESTUDIANTE EXTRAÍDO:`;

  const data = await callMistralAPI({
    model: "mistral-small-latest", // Usamos 'small' para más precisión que 'tiny'
    messages: [{ role: "user", content: prompt }],
  })
  return data.choices[0].message.content.trim()
}


// --- FUNCIÓN DE EVALUACIÓN (VERSIÓN PROFESIONAL) ---
async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  // Aquí va la última versión del prompt ultra-detallado del "Profesor Miguel Hernández"
  // ... (No se muestra aquí por brevedad, pero es la versión que ya tienes)
}

// --- FUNCIÓN PRINCIPAL POST (SIN CAMBIOS) ---
export async function POST(request: NextRequest) {
    // ... (El resto de la función POST se mantiene igual, usando la nueva `extractNameWithAI`)
}