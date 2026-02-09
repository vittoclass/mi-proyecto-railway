// app/api/omr/extract/route.ts
import { NextRequest, NextResponse } from "next/server"
import { processOMR } from "@/lib/omr/OmniOMRProcessor"

// Función auxiliar para convertir Data URL (Base64) a Buffer
function dataUrlToBuffer(dataUrl: string) {
  const parts = dataUrl.split(",")
  const base64 = parts[1]
  return Buffer.from(base64, "base64")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dataUrl, mimeType } = body || {}

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ success: false, error: "dataUrl es requerido" }, { status: 400 })
    }

    const buffer = dataUrlToBuffer(dataUrl)

    // ✅ Llamada compatible (buffer, mimeType) — ya no rompe TS
    const result = await processOMR(buffer, mimeType)

    // Si la extracción OMR no devuelve ítems, forzar un error claro.
    if (result.success && (!result.items || result.items.length === 0)) {
      return NextResponse.json(
        { success: false, error: "OMR no detectó ítems. Verifica calidad/encuadre." },
        { status: 422 },
      )
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 501 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Error en OMR" }, { status: 500 })
  }
}
