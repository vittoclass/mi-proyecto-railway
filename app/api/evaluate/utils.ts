import type { DocumentAnalysisClient } from "@azure/ai-form-recognizer"

interface FileBuffer {
  buffer: Buffer
  mimeType: string
  captureMode?: string
}

export async function extractTextFromFiles(fileBuffers: FileBuffer[], client: DocumentAnalysisClient): Promise<string> {
  if (!fileBuffers || fileBuffers.length === 0) {
    return "NO SE PUDO EXTRAER TEXTO."
  }

  const textResults: string[] = []

  for (const fileBuffer of fileBuffers) {
    try {
      // Determinar si es imagen o PDF basándose en el MIME type
      const isImage = fileBuffer.mimeType.startsWith("image/")
      const isPdf = fileBuffer.mimeType === "application/pdf"

      if (!isImage && !isPdf) {
        console.warn(`[v0] Tipo de archivo no soportado: ${fileBuffer.mimeType}`)
        continue
      }

      console.log(`[v0] Ejecutando OCR de Azure para archivo tipo: ${fileBuffer.mimeType}`)

      // Usar Azure Document Intelligence para extraer texto
      const poller = await client.beginAnalyzeDocument("prebuilt-read", fileBuffer.buffer)
      const result = await poller.pollUntilDone()

      if (!result.content || result.content.trim().length === 0) {
        console.warn("[v0] OCR no pudo extraer contenido del archivo")
        continue
      }

      textResults.push(result.content)
    } catch (error) {
      console.error("[v0] Error al extraer texto con OCR:", error)
      continue
    }
  }

  if (textResults.length === 0) {
    return "NO SE PUDO EXTRAER TEXTO."
  }

  console.log(`[v0] Texto extraído exitosamente de ${textResults.length} archivo(s)`)

  return textResults.join("\n\n--- PÁGINA SIGUIENTE ---\n\n")
}
