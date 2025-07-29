import { type NextRequest, NextResponse } from "next/server";

// La plantilla del prompt no cambia
const systemPromptTemplate = `
Eres un sistema experto de análisis de evaluaciones. Tu función es desglosar el trabajo de un estudiante con precisión quirúrgica y rellenar un informe estructurado. Eres objetivo, detallado y te basas 100% en la evidencia visible en las imágenes.

**INPUTS DEL PROFESOR:**
1.  **RÚBRICA (Criterios cualitativos):** """{rubrica}"""
2.  **PAUTA DE CORRECCIÓN (Respuestas y puntajes correctos):** """{pauta_correccion}"""

**ALGORITMO DE CORRECCIÓN (SIGUE ESTOS PASOS ESTRICTAMENTE):**

**PASO 1: ANÁLISIS ÍTEM POR ÍTEM.**
* Recorre CADA pregunta de la prueba.
* Para ítems de selección (alternativas, V/F): Compara la respuesta del estudiante (lo que marcó) con la PAUTA. Anota si es 'Correcta' o 'Incorrecta' y cuál era la respuesta correcta.
* Para ítems de desarrollo: Lee la respuesta del estudiante. Evalúala contra CADA criterio de la RÚBRICA y asigna un puntaje parcial para esa pregunta.

**PASO 2: ANÁLISIS DE HABILIDADES CON EVIDENCIA.**
* Revisa los criterios de la RÚBRICA (ej: 'Comprensión del texto', 'Desarrollo de ideas'). Estos son las 'habilidades' a evaluar.
* Para cada habilidad, escribe una evaluación concisa de si fue 'Lograda', 'Parcialmente Lograda' o 'Por Mejorar'.
* **OBLIGATORIO:** Justifica tu evaluación para cada habilidad citando una frase corta textual del trabajo del estudiante que sirva como evidencia directa.

**PASO 3: CÁLCULO DE PUNTAJE Y NOTA.**
* Suma los puntajes de todos los ítems para obtener un Puntaje Total.
* Convierte el Puntaje Total a una Nota Final (escala 1.0 a 7.0, 60% exigencia para el 4.0).

**PASO 4: CONSTRUCCIÓN DEL INFORME JSON.**
* Rellena el siguiente objeto JSON. No añadas texto fuera de la estructura.

**FORMATO DE RESPUESTA OBLIGATORIO (JSON VÁLIDO):**
{
  "nota": "La nota final calculada, como un número (ej: 6.5)",
  "puntaje": "El puntaje total en formato texto (ej: '45/50 puntos')",
  "retroalimentacion": {
    "correccion_detallada": [
      { "seccion": "I. Selección Múltiple", "detalle": "Pregunta 1: Correcta. Pregunta 2: Incorrecta (Respuesta correcta: C)." },
      { "seccion": "II. Verdadero y Falso", "detalle": "Pregunta 1: Incorrecta (Faltó justificación). Pregunta 2: Correcta." },
      { "seccion": "III. Desarrollo Pregunta 1", "detalle": "Puntaje: 8/10. Buen análisis del simbolismo..." }
    ],
    "evaluacion_habilidades": [
      { "habilidad": "Comprensión de Texto", "evaluacion": "Lograda", "evidencia": "El estudiante demuestra esto al escribir: '...'" },
      { "habilidad": "Argumentación", "evaluacion": "Por Mejorar", "evidencia": "El argumento es débil en la frase: 'pienso que esto es malo'." }
    ],
    "resumen_general": {
        "fortalezas": "Un resumen en 2-3 puntos de los aciertos más notables, basado en la evidencia.",
        "areas_mejora": "Un resumen en 2-3 puntos de las áreas más importantes a mejorar, basado en la evidencia."
    }
  }
}
`;

async function callOpenAIVisionAPI(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload), });
  if (!response.ok) { const errorBody = await response.json().catch(() => ({ message: response.statusText })); throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`); }
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { fileUrls, rubrica, pauta, flexibilidad, tipoEvaluacion } = await request.json();
    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0 || !rubrica) { return NextResponse.json({ success: false, error: "Faltan datos en la petición." }, { status: 400 }); }
    
    let prompt = systemPromptTemplate.replace('{rubrica}', rubrica);
    prompt = prompt.replace('{pauta_correccion}', pauta || 'No se proporcionó una pauta de corrección específica.');
    prompt = prompt.replace('{flexibilidad}', flexibilidad?.toString() || '3');

    const messageContent: any[] = [{ type: "text", text: prompt }];
    fileUrls.forEach(url => { messageContent.push({ type: "image_url", image_url: { url } }); });

    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 4000,
    });

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("La IA devolvió una respuesta completamente vacía.");
    }

    // ===== INICIO DE LA CORRECCIÓN ROBUSTA =====
    let iaResult;
    try {
        iaResult = JSON.parse(content);
    } catch (e) {
        // Si JSON.parse falla, significa que la IA no devolvió un JSON válido.
        console.error("Error al parsear la respuesta de la IA. Contenido recibido:", content);
        throw new Error(`La IA devolvió una respuesta en un formato no válido. Contenido: "${content.slice(0, 100)}..."`);
    }
    // ===== FIN DE LA CORRECCIÓN ROBUSTA =====

    return NextResponse.json({ success: true, ...iaResult });
  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    return NextResponse.json({ success: false, error: `La IA de visión falló. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}` }, { status: 500 });
  }
}