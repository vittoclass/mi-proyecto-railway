// app/lib/omr/OmniOMRProcessor.ts
import sharp from "sharp"
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer"

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

// Tipos internos (para no pelear con el SDK que pone polygon como optional)
type Point2D = { x: number; y: number }
type Mark = {
  polygon: Point2D[]
  confidence: number
  state: string
}

// ✅ Type guard REAL: asegura polygon definido y usable
function hasValidPolygon(mark: any): mark is { polygon: Point2D[]; confidence?: number; state?: string } {
  return (
    Array.isArray(mark?.polygon) &&
    mark.polygon.length >= 3 && // usas [0] y [2] para bbox
    mark.polygon[0]?.x != null &&
    mark.polygon[0]?.y != null
  )
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

    // Azure Form Recognizer (prebuilt-read)
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    if (!endpoint || !key) {
      throw new Error("Credenciales de Azure faltantes")
    }

    const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key))
    const poller = await client.beginAnalyzeDocument("prebuilt-read", inputBuffer)
    const { pages } = await poller.pollUntilDone()

    const items: OMRResultItem[] = []
    let itemIndex = 1

    for (const page of pages || []) {
      // ✅ Convertimos a Mark[] (polygon YA no puede ser undefined)
      const marks: Mark[] = (page.selectionMarks || [])
        .filter((m) => m.state === "selected" && m.confidence != null && m.confidence >= 0.85)
        .filter(hasValidPolygon)
        .map((m) => ({
          polygon: m.polygon,
          confidence: m.confidence ?? 0,
          state: m.state ?? "selected",
        }))
        .sort((a, b) => {
          const yA = a.polygon[0].y
          const yB = b.polygon[0].y
          if (Math.abs(yA - yB) < 20) return a.polygon[0].x - b.polygon[0].x // izq → der
          return yA - yB // arriba → abajo
        })

      // Agrupar por filas (distancia vertical < 15px)
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

        // Mantengo tu lógica original (no la cambio).
        const letters = ["A", "B", "C", "D", "E", "F", "G"]
        const value = letters[Math.min(sorted.length - 1, letters.length - 1)]

        const first = sorted[0].polygon[0]
        const lastPoly = sorted[sorted.length - 1].polygon
        const lastPoint = lastPoly[2] ?? lastPoly[lastPoly.length - 1]

        const bbox: [number, number, number, number] = [
          first.x,
          first.y,
          (lastPoint?.x ?? first.x) - first.x,
          (lastPoint?.y ?? first.y) - first.y,
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
