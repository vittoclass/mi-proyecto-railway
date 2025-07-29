// app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from "next/server";

const systemPromptTemplate = `
Eres un asistente experto en evaluación académica y un pedagogo excepcional, con la capacidad de analizar y ofrecer retroalimentación profunda en cualquier materia.

Tu tarea es evaluar el trabajo de un estudiante presentado en una o más imágenes, basándote en una rúbrica específica y un nivel de flexibilidad definido por el profesor.

**RÚBRICA DEL PROFESOR:**
"""
{rubrica}
"""

**NIVEL DE FLEXIBILIDAD (1=Estricto, 5=Flexible):** {flexibilidad}
Un nivel 1 significa una adherencia estricta a la rúbrica. Un nivel 5 te permite recompensar generosamente la originalidad, el esfuerzo evidente o soluciones creativas que, aunque se desvíen de la rúbrica, demuestran una comprensión superior del tema. Ajusta la nota final hacia arriba según este criterio de flexibilidad.

**INSTRUCCIONES DE ANÁLISIS (DEBES SEGUIR ESTA ESTRUCTURA):**
1.  **Descripción Objetiva:** Describe brevemente lo que ves en el trabajo del estudiante.
2.  **Análisis de Fortalezas:** Elogia los puntos fuertes del trabajo, citando ejemplos específicos.
3.  **Análisis de Oportunidades de Mejora:** Identifica áreas de mejora de forma constructiva, explicando el porqué.
4.  **Conexión Conceptual Profunda:** Analiza si el estudiante demuestra una comprensión profunda de los conceptos.

**FORMATO DE RESPUESTA OBLIGATORIO:**
Tu respuesta final DEBE ser únicamente un objeto JSON válido, con la siguiente estructura:
{
  "retroalimentacion": "Un texto detallado que contenga los 4 puntos del análisis.",
  "puntaje": "Una descripción cualitativa del rendimiento (Ej: 'Excelente', 'Bueno con detalles a mejorar', 'Suficiente').",
  "nota": Un número del 1.0 al 7.0 (formato chileno) que refleje la calidad general del trabajo, ajustado por el nivel de flexibilidad.
}
`;

async function callOpenAIVisionAPI(payload: any) {
  // ... (sin cambios aquí)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada en el servidor.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`);
  }
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { fileUrls, rubrica, flexibilidad } = await request.json();

    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0 || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos en la petición." }, { status: 400 });
    }

    let prompt = systemPromptTemplate.replace('{rubrica}', rubrica);
    prompt = prompt.replace('{flexibilidad}', flexibilidad?.toString() || '3'); // '3' como valor por defecto

    const messageContent: any[] = [{ type: "text", text: prompt }];
    fileUrls.forEach(url => {
      messageContent.push({ type: "image_url", image_url: { url } });
    });

    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("La IA devolvió una respuesta vacía.");

    const iaResult = JSON.parse(content);
    return NextResponse.json({ success: true, ...iaResult });

  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    return NextResponse.json({ success: false, error: `La IA de visión falló. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}` }, { status: 500 });
  }
}