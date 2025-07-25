import { type NextRequest, NextResponse } from "next/server"

// --- Función para llamar a la API de OpenAI (sin cambios) ---
async function callOpenAIVisionAPI(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada.")

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`)
  }
  return response.json()
}

// --- FUNCIÓN PRINCIPAL POST (ACTUALIZADA) ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[] // Ahora recibimos múltiples archivos
    const rubrica = formData.get("rubrica") as string
    const flexibilidad = formData.get("flexibilidad") as string // Nuevo parámetro

    if (!files.length || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (archivos o rúbrica)." }, { status: 400 })
    }

    // 1. Convertir TODAS las imágenes a formato base64
    const image_urls = await Promise.all(
        files.map(async (file) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64Image = buffer.toString('base64');
            const mimeType = file.type;
            return { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } };
        })
    );

    // 2. Crear el prompt multimodal mejorado
    const prompt = `
      Eres un profesor experto y justo, evaluando un trabajo compuesto por ${files.length} imagen(es).
      
      - RÚBRICA DE EVALUACIÓN: 
      """
      ${rubrica}
      """
      
      - NIVEL DE FLEXIBILIDAD:
      Debes evaluar con un nivel de flexibilidad de ${flexibilidad} en una escala de 1 a 5, donde 1 es extremadamente estricto y 5 es muy benevolente. Aplica esta flexibilidad al determinar el puntaje final.

      - ANÁLISIS REQUERIDO:
      Analiza todas las imágenes adjuntas como un conjunto. En tu retroalimentación, sé específico y constructivo, mencionando elementos visuales de las imágenes para justificar tu evaluación.
      
      - FORMATO DE RESPUESTA OBLIGATORIO:
      Responde únicamente con un objeto JSON válido, con esta estructura exacta:
      {
        "retroalimentacion": "Un feedback detallado y constructivo sobre la obra visual.",
        "puntaje": "El puntaje obtenido en formato 'X/Y' según la rúbrica y la flexibilidad solicitada.",
        "nota": "La calificación final calculada en una escala de 1.0 a 7.0, basada en un 60% de exigencia."
      }
    `
    // 3. Llamar a la API de OpenAI con el modelo de visión y todas las imágenes
    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...image_urls // Añadimos el array de imágenes
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("La IA devolvió una respuesta vacía o con formato incorrecto.");
    }

    const iaResult = JSON.parse(content);

    return NextResponse.json({
      success: true,
      ...iaResult,
    })

  } catch (error) {
    console.error("Multimodal evaluation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json({
      success: false,
      error: `La IA de visión falló. Detalle: ${errorMessage}`,
    }, { status: 500 })
  }
}