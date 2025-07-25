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


export async function POST(request: NextRequest) {
  try {
    const { fileUrl, rubrica, flexibilidad } = await request.json();

    if (!fileUrl || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (URL del archivo o rúbrica)." }, { status: 400 });
    }

    // --- PROMPT ORIGINAL (EL QUE PRODUCE BUENOS RESULTADOS) ---
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
    `;

    // --- RED DE SEGURIDAD: LÓGICA DE REINTENTO ---
    let attempts = 0;
    while (attempts < 2) { // Intentaremos hasta 2 veces
      try {
        const data = await callOpenAIVisionAPI({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { "url": fileUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500,
        });
        
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("La IA devolvió una respuesta vacía."); // Esto activará el reintento
        }

        const iaResult = JSON.parse(content);
        if (iaResult.retroalimentacion && iaResult.puntaje) {
          // Si todo sale bien, retornamos el resultado y salimos del bucle
          return NextResponse.json({ success: true, ...iaResult });
        } else {
          throw new Error("El JSON de la IA no contiene las propiedades esperadas."); // Esto también activará el reintento
        }
      } catch (e) {
        attempts++;
        if (attempts >= 2) {
          // Si fallamos en el último intento, lanzamos el error para que sea capturado abajo
          throw e; 
        }
        // Pequeña pausa antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    // --- FIN DE LA RED DE SEGURIDAD ---

  } catch (error) {
    console.error("Evaluation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: `La IA falló. Detalle: ${errorMessage}` }, { status: 500 });
  }
  // Línea de respaldo para satisfacer a TypeScript
  return NextResponse.json({ success: false, error: "La IA no pudo generar una respuesta válida después de varios intentos." }, { status: 500 });
}