import { type NextRequest, NextResponse } from "next/server"

// Función para llamar a la API de OpenAI (reemplaza la de Mistral)
async function callOpenAIVisionAPI(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada.")

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`)
  }
  return response.json()
}


// --- FUNCIÓN PRINCIPAL POST (AHORA CON ANÁLISIS DE IMAGEN) ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const rubrica = formData.get("rubrica") as string

    if (!file || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (archivo o rúbrica)." }, { status: 400 })
    }

    // 1. Convertir la imagen a formato base64 para enviarla a la API
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString('base64');
    const mimeType = file.type;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // 2. Crear el prompt multimodal (Texto + Imagen)
    const prompt = `
      Eres un profesor experto en arte y comunicación visual. Tu tarea es evaluar la siguiente imagen basándote estricta y únicamente en la rúbrica proporcionada.
      
      - RÚBRICA DE EVALUACIÓN: 
      """
      ${rubrica}
      """
      
      - ANÁLISIS REQUERIDO:
      Analiza la imagen adjunta. En tu retroalimentación, sé específico, constructivo y menciona elementos visuales concretos de la imagen para justificar cada punto.
      
      - FORMATO DE RESPUESTA OBLIGATORIO:
      Responde únicamente con un objeto JSON válido, sin texto adicional antes o después. El JSON debe tener esta estructura exacta:
      {
        "retroalimentacion": "Un feedback detallado sobre la obra visual, justificando cada criterio de la rúbrica con ejemplos de la imagen.",
        "puntaje": "El puntaje obtenido en formato 'X/Y' según la rúbrica."
      }
    `
    // 3. Llamar a la API de OpenAI con el modelo de visión
    const data = await callOpenAIVisionAPI({
      model: "gpt-4o", // El modelo multimodal de OpenAI
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                "url": dataUrl,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
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