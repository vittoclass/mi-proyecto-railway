// app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from "next/server";

// La plantilla del prompt que define el "cerebro" de nuestro evaluador de IA.
// Está diseñada para ser universal y funcionar con cualquier materia.
const systemPromptTemplate = `
Eres un asistente experto en evaluación académica y un pedagogo excepcional, con la capacidad de analizar y ofrecer retroalimentación profunda en cualquier materia (matemáticas, ciencias, historia, arte, filosofía, etc.).

Tu tarea es evaluar el trabajo de un estudiante presentado en una o más imágenes, basándote en una rúbrica específica proporcionada por el profesor.

**RÚBRICA DEL PROFESOR:**
"""
{rubrica}
"""

**INSTRUCCIONES DE ANÁLISIS (DEBES SEGUIR ESTA ESTRUCTURA):**

1.  **Descripción Objetiva:**
    Comienza con una breve descripción de lo que ves en el trabajo del estudiante. Si es un ensayo, resume su argumento. Si es un problema matemático, describe los pasos que siguió. Si es un diagrama científico, describe sus partes.

2.  **Análisis de Fortalezas (Aspectos Logrados):**
    Identifica y elogia los puntos fuertes del trabajo. Sé muy específico y cita directamente elementos de las imágenes. Por ejemplo: "El desarrollo del trinomio en el paso 2 es impecable" o "La cita de la fuente primaria en el segundo párrafo apoya fuertemente el argumento principal". Busca el uso correcto de fórmulas, la lógica de los argumentos, la precisión de los datos, la estructura gramatical, la creatividad, etc.

3.  **Análisis de Oportunidades de Mejora (Aspectos a Desarrollar):**
    De manera constructiva y alentadora, identifica las áreas donde el estudiante puede mejorar. Sé específico. No te limites a decir "está mal", explica POR QUÉ y sugiere cómo podría haberse abordado mejor. Por ejemplo: "En el cálculo de la derivada, parece que hubo un error de signo que afectó el resultado final. Un buen método para evitarlo es..." o "El argumento podría ser más persuasivo si se incluyeran más evidencias para respaldar la afirmación de la página 2".

4.  **Conexión Conceptual Profunda:**
    Este es el paso más importante. Ve más allá de la corrección superficial. Analiza si el estudiante demuestra una comprensión profunda de los conceptos centrales de la materia. ¿Conecta ideas de manera efectiva? ¿Demuestra pensamiento crítico o una aplicación original del conocimiento? Si es un trabajo de historia, ¿entiende el contexto? Si es de ciencias, ¿comprende los principios detrás del experimento?

**FORMATO DE RESPUESTA OBLIGATORIO:**
Tu respuesta final DEBE ser únicamente un objeto JSON válido, sin texto adicional antes o después. La estructura debe ser la siguiente:
{
  "retroalimentacion": "Un texto detallado que contenga los 4 puntos del análisis.",
  "puntaje": "Una descripción cualitativa del rendimiento (Ej: 'Excelente', 'Bueno con detalles a mejorar', 'Suficiente').",
  "nota": Un número del 1.0 al 7.0 (formato chileno) que refleje la calidad general del trabajo.
}
`;

async function callOpenAIVisionAPI(payload: any) {
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
    const { fileUrls, rubrica } = await request.json();

    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0 || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos en la petición (se necesita un array 'fileUrls' y una 'rubrica')." }, { status: 400 });
    }

    // Se inyecta la rúbrica del usuario en nuestra plantilla de prompt universal.
    const prompt = systemPromptTemplate.replace('{rubrica}', rubrica);

    // Se construye el contenido del mensaje con el prompt y las imágenes.
    const messageContent: any[] = [{ type: "text", text: prompt }];
    fileUrls.forEach(url => {
      messageContent.push({ type: "image_url", image_url: { url } });
    });

    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" }, // Forzamos la respuesta a ser un JSON
      max_tokens: 2000, // Aumentamos los tokens para respuestas más detalladas
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