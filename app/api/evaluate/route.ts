import { type NextRequest, NextResponse } from "next/server"

// --- INTERFACES Y FUNCIONES DE CÁLCULO (SIN CAMBIOS) ---
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

// --- FUNCIONES DE API (MODIFICADAS Y MEJORADAS) ---

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

async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  const flexibilityMap: { [key: number]: string } = {
    0: "Eres un evaluador extremadamente RÍGIDO y LITERAL. Te ciñes 100% a la rúbrica.",
    5: "Eres un evaluador EQUILIBRADO y OBJETIVO. Te basas en la rúbrica pero puedes asignar puntajes parciales con justificación.",
    10: "Eres un evaluador muy FLEXIBLE y HOLÍSTICO. Valoras la creatividad y el esfuerzo más allá de la rúbrica estricta.",
  };
  const flexibilityDescription = flexibilityMap[config.flexibility] || flexibilityMap[5];

  const prompt = `### PERFIL Y MISIÓN ###
Actúas como un profesor experto y un asistente de evaluación pedagógica. Tu misión es analizar el trabajo de un estudiante, asignar un puntaje justo y generar una retroalimentación detallada, específica y constructiva.

### CONTEXTO DE LA EVALUACIÓN ###
- Evaluación: "${config.nombrePrueba}"
- Curso: "${config.curso}"
- Estudiante: "${studentName}"
- Sistema de Calificación: El puntaje máximo total para esta evaluación es **${config.puntajeMaximo} puntos**. Debes asignar un puntaje coherente dentro de esta escala.
- Rúbrica de Evaluación: """${config.rubrica}"""
- Preguntas Objetivas (si aplica): """${config.preguntasObjetivas}"""
- Tu Nivel de Flexibilidad: **${config.flexibility}/10** - ${flexibilityDescription}

### TRABAJO DEL ESTUDIANTE (TRANSCRIPCIÓN OCR) ###
"""
${text || "(Sin texto extraído - El trabajo podría ser puramente visual o no contener texto relevante)"}
"""

### TAREAS OBLIGATORIAS ###
Analiza el trabajo del estudiante y responde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido que siga esta estructura:
{
  "puntaje_obtenido": Int,
  "analisis_detallado": [
    {
      "criterio": "Nombre del criterio evaluado de la rúbrica.",
      "evidencia": "Descripción de la evidencia encontrada en el trabajo del estudiante.",
      "justificacion": "Justificación detallada de por qué se asignó el puntaje.",
      "puntaje": "Puntaje asignado para este criterio (ej: '4/6 puntos')."
    }
  ],
  "analisis_habilidades": [
    {
      "habilidad": "Nombre de la habilidad demostrada (ej: 'Pensamiento Crítico', 'Síntesis de Información', 'Aplicación de Técnica Artística').",
      "descripcion": "Descripción de cómo el estudiante demostró esta habilidad, **citando una parte específica del trabajo**."
    }
  ],
  "feedback_estudiante": {
    "resumen": "Un resumen breve y alentador del desempeño general.",
    "fortalezas": [
      {
        "descripcion": "Describe una fortaleza clave.",
        "cita": "**Cita textualmente o describe una parte específica del trabajo** que demuestre esta fortaleza."
      }
    ],
    "oportunidades": [
      {
        "descripcion": "Describe un área de mejora clara y accionable.",
        "cita": "**Cita textualmente o describe una parte específica del trabajo** donde se evidencia esta área de mejora."
      }
    ],
    "siguiente_paso_sugerido": "Una sugerencia concreta y práctica que el estudiante puede aplicar para mejorar en el futuro."
  },
  "analisis_profesor": {
    "desempeno_general": "Un análisis del desempeño para el profesor, más técnico que el del estudiante.",
    "patrones_observados": "Describe patrones de error o acierto comunes que podrías estar viendo.",
    "sugerencia_pedagogica": "Una sugerencia para el docente sobre cómo abordar las dificultades observadas en la enseñanza."
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
          analisis_habilidades: aiResult.analisis_habilidades,
          analisis_detallado: aiResult.analisis_detallado,
          bonificacion: 0,
          justificacionDecimas: "",
        };
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    return NextResponse.json({ success: true, evaluations });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error occurred" });
  }
}