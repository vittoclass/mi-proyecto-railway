// lib/omr/OmniOMRProcessor.ts
<<<<<<< Updated upstream
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
=======

export type Point2D = { x: number; y: number }

export type Mark = {
  polygon?: Point2D[]
  confidence: number
  state: string // e.g. "selected"
  // puedes tener más campos, no molestan
  [k: string]: any
}

export type OMRItem = {
  id: string
  value: string
  confidence: number
}

export type OMRResult = {
  success: boolean
  items?: OMRItem[]
  error?: string
  debug?: any
}
>>>>>>> Stashed changes

// ------------ Helpers ------------
function hasPolygon(m: Mark): m is Mark & { polygon: Point2D[] } {
  return Array.isArray(m.polygon) && m.polygon.length > 0
}

// ------------ Core: procesa MARKS (tu lógica actual) ------------
async function processMarks(marksInput: Mark[]): Promise<OMRResult> {
  try {
<<<<<<< Updated upstream
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
=======
    const marks = (marksInput || [])
      .filter((m) => m?.state === "selected" && m?.confidence != null && m.confidence >= 0.85)
      .filter(hasPolygon)
      .sort((a, b) => {
        const yA = a.polygon[0].y
        const yB = b.polygon[0].y
        if (Math.abs(yA - yB) < 20) return a.polygon[0].x - b.polygon[0].x // izq → der
        return yA - yB // arriba → abajo
      })

    // Agrupar por filas
    const rows: (Mark & { polygon: Point2D[] })[][] = []
    for (const mark of marks) {
      const y = mark.polygon[0].y
      const row = rows.find((r) => Math.abs(r[0].polygon[0].y - y) < 15)
      if (row) row.push(mark)
      else rows.push([mark])
    }

    // Convertir filas → items (placeholder simple)
    // Si tú ya tienes IDs reales por burbuja, aquí es donde se mapean.
    const items: OMRItem[] = rows.map((row, idx) => {
      const avgConf =
        row.reduce((acc, m) => acc + (m.confidence ?? 0), 0) / Math.max(1, row.length)

      // Valor simple: cantidad de marcas en la fila (para no “inventar” letras)
      // Ajusta esta parte a tu mapping real (A/B/C/D/V/F/etc.) cuando corresponda.
      return {
        id: `ROW_${idx + 1}`,
        value: String(row.length),
        confidence: Number.isFinite(avgConf) ? avgConf : 0,
>>>>>>> Stashed changes
      }
    })

<<<<<<< Updated upstream
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
=======
    return { success: true, items, debug: { rows: rows.length, marks: marks.length } }
  } catch (e: any) {
    return { success: false, error: e?.message || "OMR processing error" }
  }
}

// ------------ API: processOMR (sobrecargas) ------------

// 1) Cuando te llaman con MARKS (front u otro pipeline)
export async function processOMR(input: { marks: Mark[] }): Promise<OMRResult>

// 2) Cuando te llaman con BUFFER desde route.ts
export async function processOMR(input: Buffer, mimeType?: string): Promise<OMRResult>

// Implementación única
export async function processOMR(input: any, mimeType?: string): Promise<OMRResult> {
  // Caso A: input = { marks: [...] }
  if (input && typeof input === "object" && Array.isArray(input.marks)) {
    return processMarks(input.marks as Mark[])
  }

  // Caso B: input = Buffer (route.ts)
  // OJO: aquí NO hacemos visión real porque tu extractor de marks no está en este archivo.
  // Esto evita romper build; si quieres OMR real desde imagen, aquí conectas tu extractor real.
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    return {
      success: false,
      error:
        "processOMR(buffer) está activo para compilar, pero falta conectar el extractor real de MARKS desde imagen. " +
        "Este proyecto actualmente procesa OMR a partir de marks (polygons+confidence).",
      debug: { mimeType: mimeType || null, bytes: input.length },
    }
  }

  return { success: false, error: "Entrada inválida para processOMR()." }
>>>>>>> Stashed changes
}
