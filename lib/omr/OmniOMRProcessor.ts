// lib/omr/OmniOMRProcessor.ts
import sharp from "sharp"
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer"
import type { Point2D } from "@azure/ai-form-recognizer"

export interface OMRResultItem {
  id: string
  type: "multiple_choice" | "true_false" | "pairing" | "unknown"
  value?: string
  raw: string
  confidence: number
  bbox?: [number, number, number, number] // x, y, w, h
  warnings?: string[]
}

export interface OMRResult {
  success: boolean
  items: OMRResultItem[]
  warnings: string[]
  confidenceAvg: number
  processingTimeMs: number
}

type Mark = {
  polygon: Point2D[]
  confidence: number
  state: string
}

export async function processOMR(imageBuffer: Buffer, mimeType: string): Promise<OMRResult> {
  const start = Date.now()
  const warnings: string[] = []

  try {
    // Preprocesar a JPEG si es necesario
    let inputBuffer = imageBuffer
    if (!mimeType.includes("jpeg") && !mimeType.includes("png")) {
      inputBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer()
    }

    // Azure Document Intelligence
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    if (!endpoint || !key) throw new Error("Credenciales de Azure faltantes")

    const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key))
    const poller = await client.beginAnalyzeDocument("prebuilt-read", inputBuffer)
    const { pages } = await poller.pollUntilDone()

    const items: OMRResultItem[] = []
    let itemIndex = 1

    for (const page of pages || []) {
      const marks: Mark[] = (page.selectionMarks || [])
        .filter((m) => m.state === "selected" && m.confidence != null && m.confidence >= 0.85)
        // ✅ Validación REAL en runtime: polygon existe y tiene puntos
        .filter((m) => Array.isArray(m.polygon) && m.polygon.length >= 3 && m.polygon[0]?.x != null && m.polygon[0]?.y != null)
        .map((m) => ({
          // ✅ AQUÍ está el fix: TS a veces igual deja polygon como “| undefined”.
          // Como ya lo validamos arriba, esto es seguro.
          polygon: m.polygon!, 
          confidence: m.confidence ?? 0,
          state: m.state ?? "selected",
        }))
        .sort((a, b) => {
          // ✅ SOLUCIÓN A: sort seguro
          const pA = a.polygon?.[0]
          const pB = b.polygon?.[0]

          const yA = pA?.y ?? Number.POSITIVE_INFINITY
          const yB = pB?.y ?? Number.POSITIVE_INFINITY

          const xA = pA?.x ?? Number.POSITIVE_INFINITY
          const xB = pB?.x ?? Number.POSITIVE_INFINITY

          if (Math.abs(yA - yB) < 20) return xA - xB
          return yA - yB
        })

      // Agrupar por filas
      const rows: Mark[][] = []
      for (const mark of marks) {
        const y = mark.polygon[0].y
        const row = rows.find((r) => Math.abs(r[0].polygon[0].y - y) < 15)
        if (row) row.push(mark)
        else rows.push([mark])
      }

      // Convertir cada fila a un ítem lógico
      for (const row of rows) {
        const sorted = row.sort((a, b) => a.polygon[0].x - b.polygon[0].x)
        const id = `P${itemIndex++}`
        const type = sorted.length === 2 ? "true_false" : "multiple_choice"

        const letters = ["A", "B", "C", "D", "E", "F", "G"]
        const value = letters[Math.min(sorted.length - 1, letters.length - 1)]

        const first = sorted[0].polygon[0]
        const lastPoly = sorted[sorted.length - 1].polygon
        const lastPoint = lastPoly[2] ?? lastPoly[lastPoly.length - 1]

        const bbox: [number, number, number, number] = [
          first.x ?? 0,
          first.y ?? 0,
          (lastPoint?.x ?? first.x ?? 0) - (first.x ?? 0),
          (lastPoint?.y ?? first.y ?? 0) - (first.y ?? 0),
        ]

        items.push({
          id,
          type,
          value,
          raw: "",
          confidence: Math.min(...sorted.map((m) => m.confidence)),
          bbox,
        })
      }
    }

    const confidenceAvg = items.length ? items.reduce((sum, i) => sum + i.confidence, 0) / items.length : 0

    return {
      success: true,
      items,
      warnings,
      confidenceAvg,
      processingTimeMs: Date.now() - start,
    }
  } catch (err) {
    return {
      success: false,
      items: [],
      warnings: [`Error OMR: ${err instanceof Error ? err.message : "fallo"}`],
      confidenceAvg: 0,
      processingTimeMs: Date.now() - start,
    }
  }
}
