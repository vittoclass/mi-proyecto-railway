import { type NextRequest, NextResponse } from "next/server"

// --- FUNCIONES DE IA REQUERIDAS ---

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

async function extractNameWithAI(text: string) {
  if (!text.trim()) return ""

  const prompt = `Como profesor chileno experto, analiza esta transcripción y extrae únicamente el nombre completo del estudiante. Busca patrones como "Nombre:", "Alumno/a:", etc. Corrige errores de OCR (ej: "Jvan" → "Iván"). Responde SOLO con el nombre completo o una cadena vacía si no lo encuentras. Texto: """${text}"""`

  const data = await callMistralAPI({
    model: "mistral-tiny",
    messages: [{ role: "user", content: prompt }],
  })

  return data.choices[0].message.content.trim()
}


// --- FUNCIÓN PRINCIPAL POST (CON LÓGICA REAL) ---

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files.length) {
      return NextResponse.json({ success: false, error: "No files provided" })
    }

    // Procesar todos los archivos para extraer su texto
    let combinedText = ""
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      let extractedText = ""
      if (file.type.startsWith("image/") || file.name.endsWith(".pdf")) {
        extractedText = await ocrAzure(buffer)
      } else if (file.name.endsWith(".txt")) {
        extractedText = await file.text()
      }
      combinedText += extractedText + "\n\n"
    }

    // Usar la IA para extraer el nombre del texto combinado
    const extractedName = await extractNameWithAI(combinedText)

    return NextResponse.json({
      success: true,
      name: extractedName,
    })
  } catch (error) {
    console.error("Name extraction error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}