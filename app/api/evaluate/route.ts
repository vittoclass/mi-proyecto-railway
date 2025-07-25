// En: app/api/evaluate/route.ts (VERSIÓN CON PRE-PROCESAMIENTO DE IA)

import { type NextRequest, NextResponse } from "next/server"

// --- MISMAS FUNCIONES HELPER ---
async function callMistralAPI(payload: any) { /* ... (código sin cambios) ... */ }
async function ocrAzure(file: Buffer) { /* ... (código sin cambios) ... */ }

// --- FUNCIÓN PRINCIPAL POST (MÁS INTELIGENTE) ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const rubrica = formData.get("rubrica") as string

    if (!file || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (archivo o rúbrica)." }, { status: 400 })
    }

    // 1. Extraer texto del archivo usando Azure OCR
    const buffer = Buffer.from(await file.arrayBuffer())
    const textoCrudoOCR = await ocrAzure(buffer)

    if (!textoCrudoOCR.trim()) {
      return NextResponse.json({ success: false, error: "OCR no pudo extraer texto del documento. Asegúrate de que la imagen sea clara y legible." }, { status: 400 })
    }

    // 2. *** NUEVO PASO: Limpiar y Estructurar el texto con IA ***
    const promptLimpieza = `
      El siguiente texto fue extraído de una imagen de un trabajo escolar usando OCR y puede contener errores o estar desordenado. 
      Tu tarea es limpiarlo y estructurarlo para que sea legible y coherente. 
      Corrige errores obvios de OCR, organiza el texto en párrafos lógicos y preserva la intención original del autor.
      Responde únicamente con el texto limpio y estructurado.
      TEXTO OCR CRUDO: """${textoCrudoOCR}"""
    `
    const respuestaLimpieza = await callMistralAPI({
        model: "mistral-small-latest", // Usamos un modelo rápido para esta tarea
        messages: [{ role: "user", content: promptLimpieza }],
    })
    const textoLimpio = respuestaLimpieza.choices[0].message.content;


    // 3. Evaluar el texto ya limpio y estructurado
    const promptEvaluacion = `
      Eres un profesor experto evaluando un trabajo.
      - TAREA: Evalúa el siguiente texto limpio y estructurado de un estudiante, basándote estrictamente en la rúbrica.
      - RÚBRICA: """${rubrica}"""
      - TEXTO DEL ESTUDIANTE (LIMPIO): """${textoLimpio}"""
      - FORMATO DE RESPUESTA: Responde únicamente con un objeto JSON válido, con esta estructura:
      {
        "retroalimentacion": "Un feedback constructivo y detallado, citando partes del texto del estudiante.",
        "puntaje": "El puntaje obtenido en formato 'X/Y' según la rúbrica."
      }
    `
    const respuestaEvaluacion = await callMistralAPI({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: promptEvaluacion }],
      response_format: { type: "json_object" },
    })

    const iaResult = JSON.parse(respuestaEvaluacion.choices[0].message.content)

    return NextResponse.json({
      success: true,
      ...iaResult,
    })

  } catch (error) {
    console.error("Evaluation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json({
      success: false,
      error: `La IA falló. Detalle: ${errorMessage}`,
    }, { status: 500 })
  }
}