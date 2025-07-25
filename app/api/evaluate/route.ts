// En: app/api/evaluate/route.ts (VERSIÓN MEJORADA Y ROBUSTA)

import { type NextRequest, NextResponse } from "next/server"

// --- COPIA Y PEGA AQUÍ LAS MISMAS FUNCIONES HELPER DE TU OTRO route.ts ---
async function callMistralAPI(payload: any) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error("MISTRAL_API_KEY no está configurada.")
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Mistral API error: ${data.error?.message || response.statusText}`)
  return data
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


// --- FUNCIÓN PRINCIPAL POST PARA EVALUAR (CON MEJORAS) ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const rubrica = formData.get("rubrica") as string

    if (!file || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (archivo o rúbrica)." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const textoExtraido = await ocrAzure(buffer)

    if (!textoExtraido.trim()) {
      return NextResponse.json({ success: false, error: "No se pudo extraer texto del documento." }, { status: 400 })
    }

    const prompt = `
      Eres un profesor experto evaluando un trabajo.
      - TAREA: Evalúa el siguiente texto del estudiante basándote estrictamente en la rúbrica.
      - RÚBRICA: """${rubrica}"""
      - TEXTO DEL ESTUDIANTE: """${textoExtraido}"""
      - FORMATO DE RESPUESTA: Responde únicamente con un objeto JSON válido, sin texto adicional antes o después. El JSON debe tener esta estructura exacta:
      {
        "retroalimentacion": "Un feedback constructivo y detallado para el estudiante, con fortalezas y áreas de mejora.",
        "puntaje": "El puntaje obtenido en formato 'X/Y' según la rúbrica."
      }
    `
    let attempts = 0
    while (attempts < 2) { // Intentaremos hasta 2 veces
      try {
        const data = await callMistralAPI({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        })

        const content = data.choices[0].message.content
        const iaResult = JSON.parse(content) // El punto que podría fallar

        // Verificamos que el JSON tenga las propiedades esperadas
        if (iaResult.retroalimentacion && iaResult.puntaje) {
          return NextResponse.json({
            success: true,
            ...iaResult,
          })
        }
        // Si el JSON no tiene las propiedades, lo consideramos un error y reintentamos
        throw new Error("El JSON de la IA no tiene el formato esperado.");

      } catch (e) {
        attempts++
        if (attempts >= 2) {
          // Si fallamos en el último intento, devolvemos el error
          throw e
        }
        // Esperamos un poco antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    // Este punto no debería alcanzarse, pero es un respaldo
    throw new Error("La IA no pudo generar una respuesta válida después de varios intentos.")

  } catch (error) {
    console.error("Evaluation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido durante la evaluación"
    // Devolvemos un error claro al frontend
    return NextResponse.json({
      success: false,
      error: `La IA falló al procesar la respuesta. Detalle: ${errorMessage}`,
    }, { status: 500 })
  }
}