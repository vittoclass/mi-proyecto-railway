import { type NextRequest, NextResponse } from "next/server"

// Simulación de extracción de nombres con IA
async function extractNameFromFile(file: Buffer, fileName: string): Promise<string> {
  // Simulamos diferentes casos para demostrar la funcionalidad
  const randomNames = [
    "María González",
    "Juan Pérez",
    "Ana Rodríguez",
    "Carlos Silva",
    "Sofía Martínez",
    "Diego López",
    "Valentina Torres",
    "Mateo Herrera",
    "", // Caso donde no se encuentra nombre
  ]

  // Simulamos un delay de procesamiento
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Retornamos un nombre aleatorio para la simulación
  return randomNames[Math.floor(Math.random() * randomNames.length)]
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extractedName = await extractNameFromFile(buffer, file.name)

    return NextResponse.json({
      success: true,
      name: extractedName,
      confidence: extractedName ? 0.85 : 0.0,
    })
  } catch (error) {
    console.error("Name extraction error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}
