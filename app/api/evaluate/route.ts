import { type NextRequest, NextResponse } from "next/server"

// --- COPIA Y PEGA AQUÍ LAS MISMAS FUNCIONES HELPER ---
async function callMistralAPI(payload: any) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error("MISTRAL_API_KEY no está configurada.")
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  })
  if (!response.ok) { // Manejo de errores mejorado
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Mistral API error: ${errorBody.message || response.statusText}`)
  }
  return response.json()
}

async function ocrAzure(file: Buffer) {
  const azureKey = process.env.AZURE_VISION_KEY
  const azureEndpoint = process.env.AZURE_VISION_ENDPOINT
  if (!azureKey || !azureEndpoint) throw new Error("AZURE_VISION_KEY o AZURE_VISION_ENDPOINT no están configuradas.")
  const response = await fetch(`${azureEndpoint}vision/v3.2/ocr?language=es`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": azureKey, "Content-Type": "application/octet-stream" },
    body: file,
  })
  if (!response.ok) throw new Error(`Azure OCR error: ${response.statusText}`)
  const data = await response.json()
  return (
    data.regions
      ?.flatMap((reg: any) => reg.lines.map((l: any) => l.words.map((w: any) => w.text).join(" ")))
      .join("\n") || ""
  )
}
// --- FIN DE LAS FUNCIONES COPIADAS ---

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const rubrica = formData.get("rubrica") as string

    if (!file || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (archivo o rúbrica)." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const textoCrudoOCR = await ocrAzure(buffer)

    if (!textoCrudoOCR.trim()) {
      return NextResponse.json({ success: false, error: "OCR no pudo extraer texto del documento." }, { status: 400 })
    }
    
    // El prompt sigue siendo el mismo
    const prompt = `...` // (Tu prompt de evaluación aquí)

    // --- LÓGICA DE REINTENTO Y MANEJO DE ERRORES MEJORADA ---
    let attempts = 0;
    while (attempts < 2) {
      try {
        const data = await callMistralAPI({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        })

        // **AQUÍ ESTÁ LA CORRECCIÓN CLAVE**
        // Navegamos de forma segura por la respuesta de la IA
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error("La IA devolvió una respuesta vacía o con formato incorrecto.");
        }

        const iaResult = JSON.parse(content);

        if (iaResult.retroalimentacion && iaResult.puntaje) {
          return NextResponse.json({ success: true, ...iaResult });
        } else {
          throw new Error("El JSON de la IA no contiene las propiedades esperadas.");
        }
      } catch (e) {
        attempts++;
        if (attempts >= 2) throw e; // Si fallamos en el último intento, lanzamos el error
        await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa antes de reintentar
      }
    }

  } catch (error) {
    console.error("Evaluation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido durante la evaluación"
    return NextResponse.json({
      success: false,
      error: `La IA falló al procesar la respuesta. Detalle: ${errorMessage}`,
    }, { status: 500 })
  }
}