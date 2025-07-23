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

// --- FUNCIÓN DE EVALUACIÓN CON PROMPT MEJORADO ---
async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  const flexibilityMap: { [key: number]: string } = {
    0: "Eres un evaluador extremadamente RÍGIDO y LITERAL. Te ciñes 100% a la rúbrica.",
    5: "Eres un evaluador EQUILIBRADO y OBJETIVO. Te basas en la rúbrica pero puedes asignar puntajes parciales con justificación.",
    10: "Eres un evaluador muy FLEXIBLE y HOLÍSTICO. Valoras la creatividad y el esfuerzo más allá de la rúbrica estricta.",
  };
  const flexibilityDescription = flexibilityMap[config.flexibility] || flexibilityMap[5];

  const prompt = `### PERFIL Y MISIÓN ###
Actúas como un profesor experto y un asistente de evaluación pedagógica. Tu misión es analizar el trabajo de un estudiante, asignar un puntaje justo y generar una retroalimentación detallada, específica y "mil veces más enriquecida". Tu análisis debe ser profundo, pedagógico y siempre conectado con la evidencia del trabajo.

### CONTEXTO DE LA EVALUACIÓN ###
- Evaluación: "${config.nombrePrueba}"
- Curso: "${config.curso}"
- Estudiante: "${studentName}"
- Sistema de Calificación: El puntaje máximo total para esta evaluación es **${config.puntajeMaximo} puntos**. Tu puntaje asignado DEBE ser coherente con esta escala.
- Rúbrica de Evaluación: """${config.rubrica}"""
- Preguntas Objetivas (si aplica): """${config.preguntasObjetivas}"""
- Tu Nivel de Flexibilidad: **${config.flexibility}/10** - ${flexibilityDescription}

### TRABAJO DEL ESTUDIANTE (TRANSCRIPCIÓN OCR) ###
"""
${text || "(Sin texto extraído - El trabajo podría ser puramente visual o no contener texto relevante)"}
"""

### TAREAS OBLIGATORIAS Y FORMATO DE RESPUESTA ###
Analiza el trabajo y responde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido. Sigue estrictamente la estructura y las instrucciones para cada campo.

#### EJEMPLO DE RESPUESTA DE ALTA CALIDAD:
\`\`\`json
{
  "puntaje_obtenido": 24,
  "analisis_detallado": [
    {
      "criterio": "Crítica Social",
      "evidencia": "La ilustración representa a personas absortas en sus teléfonos mientras ignoran su entorno.",
      "justificacion": "El estudiante aborda claramente el tema de la alienación digital. La crítica es profunda porque no solo muestra el problema, sino que utiliza colores grises en las personas y colores vibrantes en el mundo exterior para simbolizar lo que se están perdiendo. Conecta directamente con el criterio de la rúbrica.",
      "puntaje": "6/7 puntos"
    }
  ],
  "analisis_habilidades": [
    {
      "habilidad": "Comunicación Visual",
      "descripcion": "El estudiante demuestra una excelente habilidad para comunicar un mensaje complejo sin texto, usando eficazmente el simbolismo del color para guiar la interpretación del espectador."
    }
  ],
  "feedback_estudiante": {
    "resumen": "¡Gran trabajo, [Nombre del Estudiante]! Tu ilustración sobre la alienación digital es visualmente impactante y transmite un mensaje crítico muy relevante y claro.",
    "fortalezas": [
      {
        "descripcion": "Tu capacidad para usar el color simbólicamente es tu mayor fortaleza en este trabajo.",
        "cita": "El contraste entre los grises de las figuras humanas y los colores vivos del parque es una decisión de diseño muy inteligente y efectiva que refuerza tu mensaje."
      }
    ],
    "oportunidades": [
      {
        "descripcion": "Podrías mejorar la composición para guiar aún más la mirada del espectador.",
        "cita": "Por ejemplo, la figura de la esquina inferior derecha está un poco aislada. Si la hubieras acercado más al grupo central, podrías haber creado un sentido de unidad más fuerte en la alienación que criticas."
      }
    ],
    "siguiente_paso_sugerido": "Para tu próximo trabajo, te sugiero experimentar con la 'regla de los tercios' en tu boceto inicial para fortalecer aún más tus composiciones."
  },
  "analisis_profesor": {
    "desempeno_general": "El estudiante demuestra una comprensión conceptual avanzada del tema y posee las habilidades técnicas para ejecutar su visión. Muestra un alto potencial.",
    "patrones_observados": "Tiende a concentrar los elementos principales en el centro, podría beneficiarse de explorar composiciones más dinámicas.",
    "sugerencia_pedagogica": "Recomendar al estudiante el estudio de artistas como Banksy o Pawel Kuczynski para inspirar enfoques en la composición de crítica social."
  }
}
\`\`\`

### TU TURNO: GENERA EL JSON PARA EL TRABAJO PROPORCIONADO ###
Ahora, genera el objeto JSON para el trabajo del estudiante que te he pasado, siguiendo el mismo nivel de detalle y especificidad del ejemplo.`;

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