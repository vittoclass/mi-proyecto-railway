import { type NextRequest, NextResponse } from "next/server"

// --- INTERFACES Y FUNCIONES AUXILIARES (SIN CAMBIOS) ---
interface EvaluationConfig {
  sistema: string; nivelExigencia: number; puntajeMaximo: number; notaAprobacion: number; flexibility: number; fecha: string; nombrePrueba: string; curso: string; rubrica: string; preguntasObjetivas: string;
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
async function extractNameWithAI(text: string) {
  if (!text.trim()) return "";
  const prompt = `De la siguiente transcripción, extrae el nombre completo del estudiante. Tu respuesta debe ser ÚNICA Y EXCLUSIVAMENTE el nombre, sin explicaciones. Si no hay nombre, responde con una cadena vacía. Texto: """${text}"""`;
  const data = await callMistralAPI({
    model: "mistral-tiny",
    messages: [{ role: "user", content: prompt }],
  });
  return data.choices[0].message.content.trim();
}

// --- NUEVA ARQUITECTURA DE EVALUACIÓN EN DOS PASOS ---

// PASO 1: IA Analista - Se enfoca solo en puntuar objetivamente
async function getScoreFromAI(text: string, config: EvaluationConfig) {
  const prompt = `### MISIÓN: ANALISTA CUANTITATIVO ###
Tu única tarea es evaluar el siguiente trabajo de un estudiante contra la rúbrica y puntuarlo objetivamente.

### CONTEXTO ###
- Rúbrica de Evaluación: """${config.rubrica}"""
- Preguntas Objetivas (si aplica): """${config.preguntasObjetivas}"""
- Puntaje Máximo Total: ${config.puntajeMaximo}

### TRABAJO DEL ESTUDIANDE ###
"""${text}"""

### FORMATO DE RESPUESTA OBLIGATORIO ###
Responde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON que contenga el puntaje detallado y el puntaje total.
{
  "analisis_detallado": [
    {
      "criterio": "Nombre del criterio de la rúbrica.",
      "puntaje_asignado": "Puntaje numérico para este criterio.",
      "puntaje_maximo_criterio": "Puntaje máximo para este criterio.",
      "justificacion_corta": "Justificación muy breve y objetiva del puntaje."
    }
  ],
  "puntaje_obtenido_total": Int
}`;
  
  const data = await callMistralAPI({
    model: "mistral-large-latest", // Usamos el modelo grande para un análisis preciso
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(data.choices[0].message.content);
}

// PASO 2: IA Pedagogo - Se enfoca en redactar el feedback, usando el puntaje del paso 1
async function getFeedbackFromAI(text: string, config: EvaluationConfig, studentName: string, scoreResult: any) {
  const prompt = `### PERFIL: PROFESOR PEDAGOGO EXPERTO ###
Tu misión es redactar una retroalimentación enriquecida y específica para un estudiante, basándote en un análisis de puntaje que ya fue realizado.

### REGLAS CRÍTICAS ###
1.  **CERO GENERALIDADES:** CADA comentario DEBE estar directamente conectado con la evidencia del trabajo.
2.  **USA EL PUNTAJE DADO:** Tu feedback debe justificar y explicar el puntaje que se te entrega. No inventes un nuevo puntaje.

### CONTEXTO ###
- Evaluación: "${config.nombrePrueba}"
- Estudiante: "${studentName}"
- Rúbrica: """${config.rubrica}"""
- **Análisis de Puntaje (tu base para el feedback):** \`\`\`json
  ${JSON.stringify(scoreResult, null, 2)}
  \`\`\`

### TRABAJO DEL ESTUDIANTE ###
"""${text}"""

### FORMATO DE RESPUESTA OBLIGATORIO ###
Responde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON. Para cada fortaleza y oportunidad, DEBES describir una parte específica del trabajo que lo demuestre.
{
  "feedback_estudiante": {
    "resumen": "Un resumen breve y alentador del desempeño general, consistente con el puntaje.",
    "fortalezas": [
      {
        "descripcion": "Describe una fortaleza clave.",
        "cita": "Describe la parte específica del trabajo (ej: 'En la ilustración de la sociedad actual, el uso de una balanza desequilibrada para representar la injusticia...') que demuestra esta fortaleza."
      }
    ],
    "oportunidades": [
      {
        "descripcion": "Describe un área de mejora clara y accionable.",
        "cita": "Describe la parte específica del trabajo (ej: 'La reflexión sobre la crítica social es un buen comienzo, pero para alcanzar el puntaje máximo, podrías haber incluido un símbolo que represente las consecuencias de esa desigualdad...') donde se evidencia."
      }
    ],
    "siguiente_paso_sugerido": "Una sugerencia concreta y práctica que el estudiante puede aplicar."
  },
  "analisis_profesor": {
    "desempeno_general": "Análisis técnico del desempeño para el profesor.",
    "sugerencia_pedagogica": "Una sugerencia para el docente sobre cómo abordar las dificultades observadas."
  }
}`;
  
  const data = await callMistralAPI({
    model: "mistral-large-latest", // Usamos el modelo grande para una redacción de calidad
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(data.choices[0].message.content);
}


// --- FUNCIÓN PRINCIPAL POST (REFACTORIZADA) ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const configStr = formData.get("config") as string;
    const config: EvaluationConfig = JSON.parse(configStr);

    if (!files.length) {
      return NextResponse.json({ success: false, error: "No se proporcionaron archivos." });
    }

    const evaluations = [];
    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";
        if (file.type.startsWith("image/") || file.name.endsWith(".pdf")) {
          extractedText = await ocrAzure(buffer);
        } else if (file.name.endsWith(".txt")) {
          extractedText = await file.text();
        }

        const studentName = (await extractNameWithAI(extractedText)) || `Estudiante_${file.name.split(".")[0]}`;
        
        // --- NUEVO FLUJO DE DOS PASOS ---
        // 1. Obtener el puntaje
        const scoreResult = await getScoreFromAI(extractedText, config);
        
        // 2. Obtener el feedback basado en el puntaje
        const feedbackResult = await getFeedbackFromAI(extractedText, config, studentName, scoreResult);
        
        const puntajeObtenido = scoreResult.puntaje_obtenido_total;

        const finalGrade = calculateFinalGrade(
          puntajeObtenido, config.puntajeMaximo, config.sistema, config.nivelExigencia, config.notaAprobacion
        );

        const evaluation = {
          id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nombreEstudiante: studentName,
          nombrePrueba: config.nombrePrueba,
          curso: config.curso,
          notaFinal: finalGrade,
          puntajeObtenido: puntajeObtenido,
          configuracion: config,
          feedback_estudiante: feedbackResult.feedback_estudiante,
          analisis_profesor: feedbackResult.analisis_profesor,
          analisis_detallado: scoreResult.analisis_detallado,
        };
        evaluations.push(evaluation as any);
      } catch (error) {
        console.error(`Error procesando el archivo ${file.name}:`, error);
        if (error instanceof Error) {
            const evaluationError = {
                id: `error_${Date.now()}`,
                nombreEstudiante: `Error en archivo ${file.name}`,
                nombrePrueba: config.nombrePrueba,
                curso: config.curso,
                notaFinal: 1.0,
                puntajeObtenido: 0,
                configuracion: config,
                feedback_estudiante: { resumen: `Error: ${error.message}` }
            };
            evaluations.push(evaluationError as any);
        }
      }
    }

    if (evaluations.length === 0 && files.length > 0) {
      return NextResponse.json({
        success: false,
        error: "No se pudo procesar ningún archivo. Revisa los registros del servidor para más detalles.",
      });
    }

    return NextResponse.json({ success: true, evaluations });
  } catch (error) {
    console.error("Error general en la evaluación:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Ocurrió un error desconocido",
    });
  }
}