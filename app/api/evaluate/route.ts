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
  const prompt = `De la siguiente transcripción de un documento, extrae el nombre completo del estudiante. Busca patrones como "Nombre:", "Alumno:", o similar. Tu respuesta debe ser ÚNICA Y EXCLUSIVAMENTE el nombre completo, sin saludos ni explicaciones. Si no encuentras un nombre claro, responde con una cadena vacía. Texto: """${text}"""`;
  const data = await callMistralAPI({
    model: "mistral-tiny",
    messages: [{ role: "user", content: prompt }],
  });
  return data.choices[0].message.content.trim();
}

// --- FUNCIÓN DE EVALUACIÓN CON PROMPT DE NIVEL EXPERTO v2 ---
async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  const flexibilityMap: { [key: number]: string } = {
    0: "Eres un evaluador extremadamente RÍGIDO y LITERAL. Te ciñes 100% a la rúbrica.",
    5: "Eres un evaluador EQUILIBRADO y OBJETIVO. Te basas en la rúbrica pero puedes asignar puntajes parciales con justificación.",
    10: "Eres un evaluador muy FLEXIBLE y HOLÍSTICO. Valoras la creatividad y el esfuerzo más allá de la rúbrica estricta.",
  };
  const flexibilityDescription = flexibilityMap[config.flexibility] || flexibilityMap[5];

  const prompt = `### PERFIL Y MISIÓN ###
Actúas como un profesor experto y un asistente de evaluación pedagógica. Tu reputación como un evaluador detallado, justo y perspicaz está en juego. Tu misión es analizar a fondo el trabajo de un estudiante, conectando siempre tus observaciones con la evidencia concreta.

### REGLAS CRÍTICAS (NO IGNORAR) ###
1.  **CERO GENERALIDADES:** No harás afirmaciones genéricas. CADA comentario, fortaleza u oportunidad DEBE estar respaldado por una descripción o cita específica del trabajo.
2.  **INTERACCIÓN RÚBRICA-TRABAJO:** Tu análisis DEBE demostrar una interacción clara entre los criterios de la rúbrica y lo que observas en el trabajo del estudiante.
3.  **RESPUESTA EXCLUSIVAMENTE EN JSON:** Tu única salida será un objeto JSON válido, sin ningún texto introductorio o explicaciones adicionales.

### PLAN DE ACCIÓN PARA TU ANÁLISIS ###
Sigue estos pasos en orden para construir tu respuesta:
1.  **Análisis Profundo:** Lee detenidamente la rúbrica y el trabajo del estudiante. Identifica dónde y cómo cumple o no con cada criterio.
2.  **Calificación Basada en Evidencia:** Asigna un puntaje para cada criterio basado en tu análisis, asegurándote de que el puntaje total sea coherente con la escala de **${config.puntajeMaximo} puntos**.
3.  **Construcción de la Retroalimentación:** Redacta los comentarios para el estudiante y el profesor. Recuerda la REGLA CRÍTICA #1: cada punto debe estar anclado a una evidencia específica.

### CONTEXTO DE LA EVALUACIÓN ###
- Evaluación: "${config.nombrePrueba}"
- Curso: "${config.curso}"
- Estudiante: "${studentName}"
- Rúbrica de Evaluación: """${config.rubrica}"""
- Preguntas Objetivas (si aplica): """${config.preguntasObjetivas}"""
- Tu Nivel de Flexibilidad: **${config.flexibility}/10** - ${flexibilityDescription}

### TRABAJO DEL ESTUDIANTE (TRANSCRIPCIÓN OCR) ###
"""
${text || "(Sin texto extraído - El trabajo podría ser puramente visual o no contener texto relevante)"}
"""

### FORMATO JSON DE SALIDA OBLIGATORIO ###
Genera el objeto JSON para el trabajo proporcionado, siguiendo estrictamente el siguiente formato y el nivel de detalle exigido.

{
  "puntaje_obtenido": Int,
  "analisis_detallado": [
    {
      "criterio": "Nombre del criterio evaluado.",
      "evidencia": "Descripción DETALLADA de la evidencia encontrada en el trabajo.",
      "justificacion": "Justificación que CONECTA la evidencia con la rúbrica.",
      "puntaje": "Puntaje para este criterio (ej: '4/6 puntos')."
    }
  ],
  "feedback_estudiante": {
    "resumen": "Resumen breve y alentador del desempeño general.",
    "fortalezas": [
      {
        "descripcion": "Describe una fortaleza clave.",
        "cita": "Describe la parte específica del trabajo (ej: 'En la esquina superior derecha, el uso del rojo sobre azul...') que demuestra esta fortaleza."
      }
    ],
    "oportunidades": [
      {
        "descripcion": "Describe un área de mejora clara y accionable.",
        "cita": "Describe la parte específica del trabajo (ej: 'La reflexión sobre la crítica social es buena, pero no mencionas cuál es el tema específico...') donde se evidencia esta área de mejora."
      }
    ],
    "siguiente_paso_sugerido": "Una sugerencia concreta y práctica que el estudiante puede aplicar."
  },
  "analisis_profesor": {
    "desempeno_general": "Análisis técnico del desempeño para el profesor.",
    "patrones_observados": "Describe patrones de error o acierto.",
    "sugerencia_pedagogica": "Una sugerencia para el docente sobre cómo abordar las dificultades observadas."
  }
}`;

  const data = await callMistralAPI({
    model: "mistral-large-latest",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    if (typeof parsed.puntaje_obtenido === "undefined" || !parsed.feedback_estudiante) {
      throw new Error("La respuesta de la IA no tiene el formato JSON esperado.");
    }
    return parsed;
  } catch (e) {
    throw new Error(`Respuesta JSON inválida de la IA: ${data.choices[0].message.content}`);
  }
}

// --- FUNCIÓN PRINCIPAL POST (SIN CAMBIOS) ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const configStr = formData.get("config") as string;
    const config: EvaluationConfig = JSON.parse(configStr);

    if (!files.length) {
      return NextResponse.json({ success: false, error: "No files provided" });
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
        const aiResult = await evaluateWithAI(extractedText, config, studentName);
        const finalGrade = calculateFinalGrade(
          aiResult.puntaje_obtenido, config.puntajeMaximo, config.sistema, config.nivelExigencia, config.notaAprobacion
        );

        const evaluation = {
          id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nombreEstudiante: studentName,
          nombrePrueba: config.nombrePrueba,
          curso: config.curso,
          notaFinal: finalGrade,
          puntajeObtenido: aiResult.puntaje_obtenido,
          configuracion: config,
          feedback_estudiante: aiResult.feedback_estudiante,
          analisis_profesor: aiResult.analisis_profesor,
          // Se elimina 'analisis_habilidades' del objeto final para no duplicar info, ya que ahora está implícito en el feedback
          analisis_detallado: aiResult.analisis_detallado,
          bonificacion: 0,
          justificacionDecimas: "",
        };
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
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

    return NextResponse.json({ success: true, evaluations });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error occurred" });
  }
}