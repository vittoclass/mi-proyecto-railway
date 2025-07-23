import { type NextRequest, NextResponse } from "next/server"

// Simulación mejorada de extracción de nombres con IA para múltiples archivos
async function extractNameFromFiles(files: Buffer[], fileNames: string[]): Promise<string> {
  // Simulamos diferentes casos para demostrar la funcionalidad
  const randomNames = [
    "María González Pérez",
    "Juan Carlos Rodríguez",
    "Ana Sofía Martínez",
    "Carlos Eduardo Silva",
    "Valentina Torres López",
    "Diego Alejandro Herrera",
    "Isabella Fernández",
    "Mateo Sebastián García",
    "", // Caso donde no se encuentra nombre
  ]

  // Simulamos un delay de procesamiento más realista
  await new Promise((resolve) => setTimeout(resolve, 800))

  // Con múltiples archivos, mayor probabilidad de encontrar nombre
  const hasMultipleFiles = files.length > 1
  const successRate = hasMultipleFiles ? 0.9 : 0.7

  if (Math.random() < successRate) {
    return randomNames[Math.floor(Math.random() * (randomNames.length - 1))]
  }

  return ""
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files.length) {
      return NextResponse.json({ success: false, error: "No files provided" })
    }

    const buffers: Buffer[] = []
    const fileNames: string[] = []

    for (const file of files) {
      buffers.push(Buffer.from(await file.arrayBuffer()))
      fileNames.push(file.name)
    }

    const extractedName = await extractNameFromFiles(buffers, fileNames)

    return NextResponse.json({
      success: true,
      name: extractedName,
      confidence: extractedName ? 0.92 : 0.0,
      filesProcessed: files.length,
    })
  } catch (error) {
    console.error("Name extraction error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}
