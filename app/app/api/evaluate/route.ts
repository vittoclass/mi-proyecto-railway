import { type NextRequest, NextResponse } from "next/server"
import { AzureKeyCredential, DocumentAnalysisClient } from "@azure/ai-form-recognizer"
import OpenAI from "openai"

const PDFJS_VERSION = "3.11.174"

const AZURE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
const AZURE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY

interface PautaItem {
  pregunta: string
  puntajeMaximo: number
}

interface AlternativaCorrecta {
  pregunta: string
  respuestaCorrecta: string
}

interface AlternativaEstudiante {
  pregunta: string
  respuesta_estudiante: string
  respuesta_correcta: string
  es_correcta: boolean
  puntaje_obtenido: number
  puntaje_maximo: number
}

interface DetalleDesarrollo {
  pregunta: string
  respuesta_estudiante: string
  puntaje_obtenido: number
  puntaje_maximo: number
  comentario: string
}

interface ResumenGeneral {
  fortalezas: string
  areas_mejora: string
  recomendaciones: string
}

interface RetroalimentacionCompleta {
  resumen_general: ResumenGeneral
  retroalimentacion_alternativas?: AlternativaEstudiante[]
  detalle_desarrollo?: DetalleDesarrollo[]
}

interface PautaCorrectaAlternativa {
  pregunta: string
  respuestaCorrecta: string
}

function parsePautaEstructurada(pautaText: string): PautaItem[] {
  if (!pautaText || typeof pautaText !== "string") return []
  const parts = pautaText.split(";").map((p) => p.trim())
  const items: PautaItem[] = []
  for (const part of parts) {
    const [pregunta, puntaje] = part.split(":").map((x) => x.trim())
    if (pregunta && puntaje) {
      items.push({ pregunta, puntajeMaximo: Number(puntaje) || 0 })
    }
  }
  return items
}

function parseAlternativasCorrectas(pautaCorrectaText: string): AlternativaCorrecta[] {
  if (!pautaCorrectaText || typeof pautaCorrectaText !== "string") return []
  const parts = pautaCorrectaText.split(";").map((p) => p.trim())
  const items: AlternativaCorrecta[] = []
  for (const part of parts) {
    const [pregunta, respuesta] = part.split(":").map((x) => x.trim())
    if (pregunta && respuesta) {
      items.push({ pregunta, respuestaCorrecta: respuesta.toUpperCase() })
    }
  }
  return items
}

async function extractTextFromImages(
  fileUrls: string[],
  mimeTypes: string[],
  client: DocumentAnalysisClient,
): Promise<string[]> {
  const allTexts: string[] = []
  for (let i = 0; i < fileUrls.length; i++) {
    const fileUrl = fileUrls[i]
    const mimeType = mimeTypes[i] || "image/png"
    try {
      const base64Data = fileUrl.replace(/^data:.*?;base64,/, "")
      const buffer = Buffer.from(base64Data, "base64")
      const poller = await client.beginAnalyzeDocument("prebuilt-read", buffer)
      const result = await poller.pollUntilDone()
      let text = ""
      if (result.content) {
        text = result.content
      }
      allTexts.push(text)
    } catch (error) {
      console.error(`Error OCR en imagen ${i}:`, error)
      allTexts.push("")
    }
  }
  return allTexts
}

async function callMistral(messages: any[], temperature = 0.2) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages,
      temperature,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Error Mistral: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || "{}"
}

function applyRFM(alternativas: AlternativaEstudiante[], pautaEstructurada: PautaItem[]): AlternativaEstudiante[] {
  const seen = new Set<string>()
  const uniqueAlternativas = alternativas.filter((alt) => {
    if (seen.has(alt.pregunta)) {
      console.log("[v0] RFM: Eliminando duplicado detectado:", alt.pregunta)
      return false
    }
    seen.add(alt.pregunta)
    return true
  })

  return uniqueAlternativas.map((alt) => {
    const pautaItem = pautaEstructurada.find((p) => p.pregunta === alt.pregunta)
    if (pautaItem) {
      const puntajeMaximo = pautaItem.puntajeMaximo
      const esCorrecta = alt.es_correcta
      return {
        ...alt,
        puntaje_maximo: puntajeMaximo,
        puntaje_obtenido: esCorrecta ? puntajeMaximo : 0,
      }
    }
    return alt
  })
}

const calculateGrade = (score: number, maxScore: number, porcentajeExigencia: number): number => {
  if (maxScore <= 0 || porcentajeExigencia <= 0) return 1.0

  const exigenciaDecimal = Math.min(100, porcentajeExigencia) / 100
  const puntosAprobacion = Math.ceil(maxScore * exigenciaDecimal)

  const puntajeEfectivo = Math.max(0, score)

  if (puntajeEfectivo === 0) return 1.0

  const APROBACION_PUNTOS = puntosAprobacion
  const PUNTAJE_MAXIMO = maxScore
  let grade: number

  if (puntajeEfectivo <= APROBACION_PUNTOS) {
    grade = 1.0 + 3.0 * (puntajeEfectivo / APROBACION_PUNTOS)
    grade = Math.min(4.0, grade)
  } else {
    const remainingPoints = PUNTAJE_MAXIMO - APROBACION_PUNTOS
    if (remainingPoints === 0) return 7.0
    grade = 4.0 + 3.0 * ((puntajeEfectivo - APROBACION_PUNTOS) / remainingPoints)
  }

  const finalRoundedGrade = Math.min(7.0, Math.round(grade * 10) / 10)
  return finalRoundedGrade
}

interface ItemScore {
  id: string
  maxScore: number
  isDevelopment: boolean
}

// Redeclared parsePautaEstructurada, removed the duplicate.
const parsePautaEstructuradaItems = (pautaStr: string): ItemScore[] => {
  const items: ItemScore[] = []
  if (!pautaStr) return items

  const pairs = pautaStr
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  for (const pair of pairs) {
    const [id, scoreStr] = pair.split(":").map((s) => s.trim())
    const maxScore = Number.parseInt(scoreStr, 10)

    if (id && !isNaN(maxScore) && maxScore > 0) {
      items.push({
        id: id,
        maxScore: maxScore,
        isDevelopment: id.toLowerCase().includes("desarrollo") || id.toLowerCase().match(/^p\d+/) !== null,
      })
    }
  }
  return items
}

const parsePautaAlternativas = (pautaStr: string): { [key: string]: string } => {
  const map: { [key: string]: string } = {}
  if (!pautaStr) return map
  const pairs = pautaStr
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  for (const pair of pairs) {
    const [id, answer] = pair.split(":").map((s) => s.trim())
    if (id && answer) {
      map[id] = answer
    }
  }
  return map
}

// Redeclared applyRFM, removed the duplicate.
const applyRFMText = (
  extractedText: string,
  preguntaId: string,
  captureMode: string | undefined,
): { text: string; confidence: "high" | "low" } => {
  if (!extractedText) return { text: "SIN_RESPUESTA", confidence: "low" }

  const cleanText = extractedText.trim().toUpperCase()

  // EXTRACCIÓN RADICAL: Solo la letra o número, sin afirmaciones

  // Para Selección Múltiple: Extraer SOLO la letra A-E
  if (captureMode === "sm_vf" || preguntaId.includes("SM") || preguntaId.match(/^\d+$/)) {
    // Buscar patrón: letra seguida de ) o : o espacio o paréntesis
    const matchWithSeparator = cleanText.match(/^([A-E])[\s):(.]/)
    if (matchWithSeparator) {
      return { text: matchWithSeparator[1], confidence: "high" }
    }

    // Buscar solo la primera letra si está al inicio
    const matchFirstLetter = cleanText.match(/^([A-E])/)
    if (matchFirstLetter) {
      return { text: matchFirstLetter[1], confidence: cleanText.length > 1 ? "low" : "high" }
    }
  }

  // Para Verdadero/Falso: Extraer SOLO V o F
  if (captureMode === "sm_vf" || preguntaId.includes("VF")) {
    const matchVF = cleanText.match(/^([VF])/)
    if (matchVF) {
      return { text: matchVF[1], confidence: cleanText.length > 1 ? "low" : "high" }
    }
  }

  // Para Términos Pareados: Extraer SOLO el número
  if (captureMode === "terminos_pareados" || preguntaId.includes("TP")) {
    const numMatch = cleanText.match(/(\d+)/)
    if (numMatch) {
      return { text: numMatch[1], confidence: "high" }
    }
  }

  // Si no se encontró nada específico, buscar cualquier letra o número válido
  const fallbackMatch = cleanText.match(/^([A-F]|\d+)/)
  if (fallbackMatch) {
    return { text: fallbackMatch[1], confidence: "low" }
  }

  return { text: "SIN_RESPUESTA", confidence: "low" }
}

const generalPromptBase = (
  rubrica: string,
  pauta: string,
  puntajeTotal: number,
  flexibilidad: number,
  pautaEstructurada: ItemScore[],
  itemsEsperados?: string,
  nombreEstudiante?: string,
  respuestasAlternativas?: { [key: string]: string },
  pautaCorrectaAlternativas?: { [key: string]: string },
) => {
  const scoreTotal = Number(puntajeTotal) > 0 ? Number(puntajeTotal) : 51
  const desarrolloItems = pautaEstructurada ? pautaEstructurada.filter((i) => i.isDevelopment) : []

  const desarrolloPuntajes = desarrolloItems.map((item) => `${item.id} (Máx: ${item.maxScore} puntos)`).join(", ")

  const nombreInstruccion =
    nombreEstudiante && nombreEstudiante.trim() && nombreEstudiante !== "Estudiante"
      ? `\n**IMPORTANTE: El nombre del estudiante es "${nombreEstudiante}". DEBES usar este nombre al escribir las fortalezas y áreas de mejora (ej: "${nombreEstudiante} demuestra...", "${nombreEstudiante} debe mejorar..."). NO uses "El estudiante" si tienes el nombre real.**\n`
      : `\n**IMPORTANTE: No se proporcionó el nombre del estudiante. DEBES usar "El estudiante" o "La estudiante" al escribir las fortalezas y áreas de mejora (ej: "El estudiante demuestra...", "El estudiante debe mejorar..."). NUNCA dejes el sujeto sin especificar.**\n`

  return (
    `Actúa como un profesor universitario riguroso. El objetivo es la **EVALUACIÓN CUALITATIVA** y la **PUNTUACIÓN DIRECTA**, priorizando la precisión de la rúbrica.
    
    El puntaje máximo de la evaluación es: ${scoreTotal} puntos.
    
    ${nombreInstruccion}
    
    ${pauta ? `PAUTA DE RESPUESTAS (Preguntas de Desarrollo/Abiertas):\n${pauta}\n\n` : ""}` +
    `RÚBRICA DE EVALUACIÓN (CRITERIO PARA DESARROLLO - APLICAR ESCALA 0 A MÁXIMO DEL ÍTEM):\n${rubrica}
    
    ---
    REGLAS DE ORO PROCEDIMENTALES (OBLIGATORIO Y NO NEGOCIABLE):
    
    1. EVALUACIÓN DE ALTERNATIVAS (S.M., V/F, TÉRMINOS PAREADOS): **EXTRACCIÓN DE SOLO LA OPCIÓN MARCADA - NO LA AFIRMACIÓN COMPLETA**
        
        **CRÍTICO - EXTRACCIÓN OBLIGATORIA:**
        * Para **SELECCIÓN MÚLTIPLE (SM)**: Extrae SOLO la **LETRA** que marcó el estudiante (A, B, C, D, E). **NUNCA extraigas la afirmación completa que acompaña a la letra**. 
          - CORRECTO: "B"
          - INCORRECTO: "B) La fotosíntesis es un proceso..." 
          - Si el OCR dice "El estudiante marcó B) La fotosíntesis...", extrae SOLO "B"
        
        * Para **VERDADERO/FALSO (VF)**: Extrae SOLO "V" o "F". **NUNCA extraigas la afirmación**.
          - CORRECTO: "V"
          - INCORRECTO: "V) La tierra es redonda"
        
        * Para **TÉRMINOS PAREADOS**: Extrae SOLO el **NÚMERO** que empareja (1, 2, 3, 4, etc.). **NUNCA extraigas el término completo**.
          - CORRECTO: "3"
          - INCORRECTO: "3) Proceso de respiración celular"
        
        * **SI NO HAY RESPUESTA VISIBLE**: Escribe "SIN_RESPUESTA"
        
        * **PAUTA DEL PROFESOR**: Usa ÚNICAMENTE las respuestas correctas de la pauta oficial. NUNCA inventes.

    2. PUNTUACIÓN DE DESARROLLO (DIRECTA Y CONSISTENTE): Para generar el puntaje de las Preguntas de Desarrollo, **UTILIZA EL PUNTAJE MÁXIMO REAL DEL PROFESOR** (ej. 2 puntos). **Asigna un puntaje de 0 a MÁXIMO (ej. /2) basándote en la Rúbrica y la Generosidad.**
        * Ítems de Desarrollo y sus Máximos: ${desarrolloPuntajes}
        * **CRITERIO DE GENEROSIDAD CALIBRADA:** Si el concepto principal de la respuesta (según la pauta) es identificable **(AUNQUE SEA BREVE O MAL ESCRITO)**, el puntaje debe ser **MÍNIMO 1 PUNTO** (si Máx > 1). Solo asigna 0/Máx si la respuesta es totalmente incomprensible o está en blanco.
        * **FORMATO DE PUNTAJE:** El campo "puntaje" debe ser "PUNTAJE OBTENIDO/MAX_ITEM" (ej. "2/2", "1/3").
    
    3. **CITACIÓN CON NOMBRE:** En 'fortalezas' y 'áreas de mejora', **DEBES usar el nombre del estudiante proporcionado** (si existe). Si no hay nombre, usa "El estudiante" o "La estudiante". **NUNCA escribas frases sin sujeto.**
        * CORRECTO: "${nombreEstudiante || "El estudiante"} demuestra excelente comprensión..."
        * INCORRECTO: "Demuestra excelente comprensión..." (sin sujeto)
    
    4. **EVIDENCIA TEXTUAL:** El campo 'evidencia' en evaluacion_habilidades **DEBE ser una CITA TEXTUAL EXACTA** del trabajo del estudiante.
    
    5. JUSTIFICACIÓN: Indica **CLARAMENTE** POR QUÉ (según la rúbrica) la cita es una fortaleza o un área de mejora.

    ---
    INSTRUCCIONES DE DATOS CRÍTICAS:
    
    **El campo "nota" en el JSON DEBE ser un valor PLACEHOLDER 0.0.**
    
    ---
    
    INSTRUCCIONES DE FORMATO: Devuelve un JSON con la estructura exacta solicitada, sin texto explicativo. **DEBES POBLAR EL ARRAY 'retroalimentacion_alternativas'.** El campo \`puntaje\` debe reflejar solo la suma de los puntos de desarrollo (ya que el servidor calcula el resto).
    
    \`\`\`json
    {
      "puntaje": "PUNTAJE_DESARROLLO_OBTENIDO/PUNTAJE_TOTAL", 
      "nota": 0.0, 
      "retroalimentacion": {
        "resumen_general": { 
          "fortalezas": "${nombreEstudiante || "El estudiante"} [CITA TEXTUAL Y JUSTIFICACIÓN].", 
          "areas_mejora": "${nombreEstudiante || "El estudiante"} [CITA TEXTUAL Y JUSTIFICACIÓN]." 
        },
        "detalle_puntaje_desarrollo": { 
              "P1": { 
                "puntaje": "PUNTAJE_OBTENIDO/MAX_ITEM", 
                "cita_estudiante": "CITA TEXTUAL COMPLETA DE LA RESPUESTA DEL ESTUDIANTE A ESTA PREGUNTA DE DESARROLLO.",
                "justificacion": "JUSTIFICACIÓN DEL PUNTAJE ASIGNADO BASADO EN LA CITA Y RÚBRICA."
              }
        },
        "correccion_detallada": [ {"seccion": "...", "detalle": "..."} ],
        "evaluacion_habilidades": [ {"habilidad": "...", "evaluacion": "...", "evidencia": "CITA TEXTUAL EXACTA. OBLIGATORIO."} ],
        "retroalimentacion_alternativas": [
            { 
              "pregunta": "N° de ítem (ej: SM1, 1, VF2, TP1)", 
              "respuesta_estudiante": "SOLO LA LETRA/NÚMERO MARCADO (ej: A, C, V, F, 4, SIN_RESPUESTA) - NUNCA LA AFIRMACIÓN COMPLETA", 
              "respuesta_correcta": "RESPUESTA CORRECTA SEGÚN PAUTA (ej: B, D, F, 2)",
              "confidence": "high o low"
            }
        ]
      }
    }
    \`\`\`
    
    Considera un nivel de flexibilidad de ${flexibilidad} (1=estricto, 5=flexible) al asignar el puntaje de desarrollo.`
  )
}

const promptsExpertos = {
  general: (
    textoExtraido: string,
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) =>
    `**INSTRUCCIÓN DE TRANSCRIPCIÓN (OCR):** El siguiente texto fue extraído por el OCR (Azure Document Intelligence) y contiene la transcripción de las respuestas marcadas (alternativas/V/F) y el texto de desarrollo. **Debes utilizar esta transcripción para inferir las respuestas de desarrollo y citar las respuestas del estudiante.**\n**PAUTA DE RESPUESTAS CERRADAS (CLAVE):** ${JSON.stringify(pautaCorrectaAlternativas)}\n--- INICIO DE LA TRANSCRIPCIÓN ---\n${textoExtraido}\n--- FIN DE LA TRANSCRIPCIÓN ---\n\n${generalPromptBase(rubrica, pauta, puntajeTotal, flexibilidad, pautaEstructurada, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas)}`,
  artes: (
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) => {
    const visualFocusInstruction = `
        **INSTRUCCIÓN CRÍTICA DE ASIGNATURA: ARTES VISUALES - PROFESOR CRÍTICO Y CONCEPTUAL** 🎨
        Tu rol es actuar como un Profesor de Arte Constructivo. Tu objetivo es fomentar el crecimiento y la intención conceptual. Tu análisis debe ser principalmente constructivo, siguiendo esta secuencia OBLIGATORIA:
        
        **SECUENCIA OBLIGATORIA DE EVALUACIÓN VISUAL:**
        1.  **DESCRIPCIÓN FORMAL:** Describe la obra objetivamente (medio, trazo, composición, paleta, textura, etc.).
        2.  **INTERPRETACIÓN CONCEPTUAL:** Analiza la intención y el mensaje de la obra.
        3.  **APLICACIÓN DE RÚBRICA:** Engancha la interpretación conceptual con los criterios de la Rúbrica para asignar la puntuación.
        
        REGLA DE ORO ESPECÍFICA DE ARTES:
        1.  PRIORIZACIÓN DEL LOGRO CONCEPTUAL: Si el logro conceptual y compositivo es evidente, la nota debe ser generosa (6.5 a 7.0). El rigor técnico tiene un peso insignificante.
        2.  CLÁUSULA DE CITACIÓN VISUAL: Las 'fortalezas', 'mejoras' y 'evidencia' deben ser **DESCRIPCIONES FORMALES Y TÉCNICAS** referidas al logro general.
        ---
        `
    return (
      visualFocusInstruction +
      generalPromptBase(
        rubrica,
        pauta,
        Number(puntajeTotal),
        flexibilidad,
        pautaEstructurada,
        itemsEsperados,
        nombreEstudiante,
        respuestasAlternativas,
        pautaCorrectaAlternativas,
      )
    )
  },
  matematicas: (
    textoExtraido: string,
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) =>
    promptsExpertos.general(
      textoExtraido,
      rubrica,
      pauta,
      puntajeTotal,
      flexibilidad,
      pautaEstructurada,
      itemsEsperados,
      nombreEstudiante,
      respuestasAlternativas,
      pautaCorrectaAlternativas,
    ),
  lenguaje: (
    textoExtraido: string,
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) =>
    promptsExpertos.general(
      textoExtraido,
      rubrica,
      pauta,
      puntajeTotal,
      flexibilidad,
      pautaEstructurada,
      itemsEsperados,
      nombreEstudiante,
      respuestasAlternativas,
      pautaCorrectaAlternativas,
    ),
  ciencias: (
    textoExtraido: string,
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) =>
    promptsExpertos.general(
      textoExtraido,
      rubrica,
      pauta,
      puntajeTotal,
      flexibilidad,
      pautaEstructurada,
      itemsEsperados,
      nombreEstudiante,
      respuestasAlternativas,
      pautaCorrectaAlternativas,
    ),
  humanidades: (
    textoExtraido: string,
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) =>
    promptsExpertos.general(
      textoExtraido,
      rubrica,
      pauta,
      puntajeTotal,
      flexibilidad,
      pautaEstructurada,
      itemsEsperados,
      nombreEstudiante,
      respuestasAlternativas,
      pautaCorrectaAlternativas,
    ),
  ingles: (
    textoExtraido: string,
    rubrica: string,
    pauta: string,
    puntajeTotal: number,
    flexibilidad: number,
    pautaEstructurada: ItemScore[],
    itemsEsperados?: string,
    nombreEstudiante?: string,
    respuestasAlternativas?: { [key: string]: string },
    pautaCorrectaAlternativas?: { [key: string]: string },
  ) =>
    promptsExpertos.general(
      textoExtraido,
      rubrica,
      pauta,
      puntajeTotal,
      flexibilidad,
      pautaEstructurada,
      itemsEsperados,
      nombreEstudiante,
      respuestasAlternativas,
      pautaCorrectaAlternativas,
    ),
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = require("pdfjs-dist")
    if (typeof (pdfjs as any).GlobalWorkerOptions !== "undefined") {
    }
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
    let fullText = ""
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str || "").join(" ")
      fullText += pageText + "\n"
    }
    return fullText
  } catch (error) {
    console.error("Error extrayendo texto de PDF digital:", error)
    return ""
  }
}
async function extractTextFromDigitalDocument(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf" || mimeType.includes("officedocument") || mimeType.includes("spreadsheetml")) {
    return ""
  }
  return ""
}
async function extractTextFromFiles(
  fileBuffers: { buffer: Buffer; mimeType: string; captureMode?: string }[],
  docIntelClient: DocumentAnalysisClient,
): Promise<string> {
  let allText = ""
  let needsOCR = false
  const ocrFiles: { buffer: Buffer; mimeType: string; captureMode?: string }[] = []
  for (const { buffer, mimeType, captureMode } of fileBuffers) {
    if (
      mimeType.startsWith("image/") ||
      mimeType === "application/pdf" ||
      mimeType.includes("officedocument") ||
      mimeType.includes("spreadsheetml")
    ) {
      ocrFiles.push({ buffer, mimeType, captureMode })
      needsOCR = true
    } else {
      console.warn(`Archivo ignorado: Tipo MIME no soportado para extracción de texto: ${mimeType}`)
    }
  }
  if (needsOCR && ocrFiles.length > 0) {
    console.log(`Ejecutando OCR de Azure para ${ocrFiles.length} archivo(s) (Imágenes/PDF Escaneados)...`)
    const ocrText = await extractTextFromImagesOCR(ocrFiles, docIntelClient) // Changed function name
    allText += ocrText
  }

  allText = allText.replace(/\[OMR_MARK\][^]*?\n/g, "")

  return allText.trim() || "NO SE PUDO EXTRAER TEXTO."
}

// Redeclared extractTextFromImages, renamed to extractTextFromImagesOCR to avoid conflict.
async function extractTextFromImagesOCR(
  ocrFiles: { buffer: Buffer; mimeType: string; captureMode?: string }[],
  docIntelClient: DocumentAnalysisClient,
): Promise<string> {
  const textPromises = ocrFiles.map(async ({ buffer, mimeType, captureMode }) => {
    try {
      const processedBuffer = buffer

      const poller = await docIntelClient.beginAnalyzeDocument("prebuilt-read", processedBuffer)
      const result = await poller.pollUntilDone()
      const content = result.content || ""

      return content
    } catch (e) {
      console.error("Error durante la extracción OCR:", e)
      return "ERROR DE EXTRACCIÓN OCR. Asegúrate de que el PDF o imagen contenga texto legible."
    }
  })
  const results = await Promise.all(textPromises)
  return results.join("\n\n--- FIN DE PÁGINA ---\n\n")
}

function buildPromptByArea(
  areaConocimiento: string,
  nivelEducativo: string,
  rubrica: string,
  pauta: string,
  flexibilidad: number,
  textosExtraidos: string[],
  pautaEstructurada: PautaItem[],
  pautaCorrectaAlternativas: PautaCorrectaAlternativa[],
  respuestasAlternativas?: AlternativaEstudiante[],
): any[] {
  const textoCompleto = textosExtraidos.join("\n\n--- PÁGINA SIGUIENTE ---\n\n")
  const listaPautaEstructurada = pautaEstructurada.map((p) => `${p.pregunta}: ${p.puntajeMaximo} pts`).join("; ")

  const listaPautaCorrecta = pautaCorrectaAlternativas.map((a) => `${a.pregunta}: ${a.respuestaCorrecta}`).join("; ")

  let promptBase = `Eres un evaluador pedagógico experto para ${areaConocimiento} en nivel ${nivelEducativo}.

**REGLA CRÍTICA DE EXTRACCIÓN:**
- DEBES extraer EXACTAMENTE lo que aparece en el texto OCR del estudiante
- SI el estudiante marca o escribe algo, extráelo LITERALMENTE
- NO inventes ni supongas respuestas que no están visibles
- SI una pregunta no tiene respuesta visible, marca como "SIN_RESPUESTA"

**REGLA CRÍTICA DE NO ALUCINACIÓN:**
- SOLO usa las respuestas correctas que te proporciono en la PAUTA OFICIAL
- NUNCA inventes respuestas correctas
- Si la pauta oficial está vacía para alternativas, NO corrijas alternativas

**PAUTA OFICIAL DE PUNTAJES (OBLIGATORIA):**
${listaPautaEstructurada}

**PAUTA OFICIAL DE ALTERNATIVAS CORRECTAS (OBLIGATORIA):**
${listaPautaCorrecta || "NO HAY ALTERNATIVAS EN ESTA PRUEBA"}

Texto OCR extraído:
${textoCompleto}

Rúbrica de desarrollo: ${rubrica || "No aplica"}
Pauta de desarrollo: ${pauta || "No aplica"}
Flexibilidad: ${flexibilidad}/5`

  if (areaConocimiento.toLowerCase().includes("artes")) {
    promptBase += `

**IMPORTANTE PARA ARTES:**
- NO calcules puntajes numéricos automáticos para preguntas de desarrollo
- SOLO proporciona retroalimentación cualitativa descriptiva
- Deja puntaje_obtenido en 0 para todas las preguntas de desarrollo
- El profesor asignará la nota final manualmente`
  }

  promptBase += `

Debes responder OBLIGATORIAMENTE en formato JSON con esta estructura:`

  if (areaConocimiento.toLowerCase().includes("artes")) {
    promptBase += `
{
  "resumen_general": {
    "fortalezas": "string",
    "areas_mejora": "string",
    "recomendaciones": "string"
  },
  "retroalimentacion_alternativas": [
    {
      "pregunta": "ID_PREGUNTA",
      "respuesta_estudiante": "EXACTAMENTE lo que escribió/marcó el estudiante",
      "respuesta_correcta": "EXACTAMENTE lo de la pauta oficial",
      "es_correcta": boolean,
      "puntaje_obtenido": number (0 o puntaje_maximo según es_correcta),
      "puntaje_maximo": number
    }
  ],
  "detalle_desarrollo": [
    {
      "pregunta": "ID_PREGUNTA",
      "respuesta_estudiante": "LITERALMENTE lo que escribió el estudiante",
      "puntaje_obtenido": 0,
      "puntaje_maximo": number (de la pauta estructurada),
      "comentario": "Retroalimentación CUALITATIVA detallada sin puntaje numérico"
    }
  ]
}`
  } else {
    promptBase += `
{
  "resumen_general": {
    "fortalezas": "string",
    "areas_mejora": "string",
    "recomendaciones": "string"
  },
  "retroalimentacion_alternativas": [
    {
      "pregunta": "ID_PREGUNTA",
      "respuesta_estudiante": "EXACTAMENTE lo que escribió/marcó el estudiante",
      "respuesta_correcta": "EXACTAMENTE lo de la pauta oficial",
      "es_correcta": boolean,
      "puntaje_obtenido": number (0 o puntaje_maximo según es_correcta),
      "puntaje_maximo": number
    }
  ],
  "detalle_desarrollo": [
    {
      "pregunta": "ID_PREGUNTA",
      "respuesta_estudiante": "LITERALMENTE lo que escribió el estudiante",
      "puntaje_obtenido": number (0 a puntaje_maximo),
      "puntaje_maximo": number (de la pauta estructurada),
      "comentario": "string"
    }
  ]
}`
  }

  if (respuestasAlternativas && respuestasAlternativas.length > 0) {
    const alternativasStr = JSON.stringify(respuestasAlternativas, null, 2)
    promptBase += `

**ALTERNATIVAS YA CORREGIDAS POR EL PROFESOR (USA ESTAS):**
${alternativasStr}

Usa EXACTAMENTE estas alternativas corregidas. NO las recalcules.`
  }

  return [{ role: "user", content: promptBase }]
}

function calculateScore(
  retroalimentacion: RetroalimentacionCompleta,
  puntajeTotalMaximo: number,
  porcentajeExigencia: number,
  pautaEstructurada: PautaItem[],
  areaConocimiento: string,
): { puntaje: string; nota: number; puntosAprobacion: number; puntosMaximos: number } {
  console.log("[v0] INICIO calculateScore")
  console.log("[v0] puntajeTotalMaximo:", puntajeTotalMaximo)
  console.log("[v0] porcentajeExigencia:", porcentajeExigencia)
  console.log("[v0] areaConocimiento:", areaConocimiento)

  // Removed conditional for 'artes' area. Now it calculates normally.
  let scoreAlternativasObtenido = 0
  let scoreDesarrolloObtenido = 0

  const alternativas = retroalimentacion.retroalimentacion_alternativas || []
  const seenAlternativas = new Set<string>()
  const uniqueAlternativas = alternativas.filter((alt) => {
    if (seenAlternativas.has(alt.pregunta)) {
      console.log("[v0] Eliminando alternativa duplicada:", alt.pregunta)
      return false
    }
    seenAlternativas.add(alt.pregunta)
    return true
  })

  console.log("[v0] Alternativas únicas:", uniqueAlternativas.length)

  for (const alt of uniqueAlternativas) {
    console.log(`[v0] Alternativa ${alt.pregunta}: ${alt.puntaje_obtenido}/${alt.puntaje_maximo}`)
    scoreAlternativasObtenido += alt.puntaje_obtenido || 0
  }

  const desarrollo = retroalimentacion.detalle_desarrollo || []
  const seenDesarrollo = new Set<string>()
  const uniqueDesarrollo = desarrollo.filter((det) => {
    if (seenDesarrollo.has(det.pregunta)) {
      console.log("[v0] Eliminando desarrollo duplicado:", det.pregunta)
      return false
    }
    seenDesarrollo.add(det.pregunta)
    return true
  })

  console.log("[v0] Desarrollo único:", uniqueDesarrollo.length)

  for (const det of uniqueDesarrollo) {
    console.log(`[v0] Desarrollo ${det.pregunta}: ${det.puntaje_obtenido}/${det.puntaje_maximo}`)
    scoreDesarrolloObtenido += det.puntaje_obtenido || 0
  }

  const puntajeObtenido = scoreAlternativasObtenido + scoreDesarrolloObtenido

  console.log("[v0] scoreAlternativasObtenido:", scoreAlternativasObtenido)
  console.log("[v0] scoreDesarrolloObtenido:", scoreDesarrolloObtenido)
  console.log("[v0] puntajeObtenido TOTAL:", puntajeObtenido)

  const puntosAprobacion = (puntajeTotalMaximo * porcentajeExigencia) / 100
  const puntosRestantes = puntajeTotalMaximo - puntosAprobacion
  const notasRestantes = 7.0 - 4.0

  console.log("[v0] puntosAprobacion (60%):", puntosAprobacion)
  console.log("[v0] puntosRestantes:", puntosRestantes)

  let notaFinal = 1.0

  if (puntajeObtenido >= puntosAprobacion) {
    const puntosExtra = puntajeObtenido - puntosAprobacion
    const proporcion = puntosRestantes > 0 ? puntosExtra / puntosRestantes : 0
    notaFinal = 4.0 + proporcion * notasRestantes
  } else {
    const proporcion = puntosAprobacion > 0 ? puntajeObtenido / puntosAprobacion : 0
    notaFinal = 1.0 + proporcion * 3.0
  }

  notaFinal = Math.max(1.0, Math.min(7.0, notaFinal))
  notaFinal = Math.round(notaFinal * 10) / 10

  console.log("[v0] notaFinal calculada:", notaFinal)
  console.log("[v0] FIN calculateScore")

  return {
    puntaje: `${puntajeObtenido}/${puntajeTotalMaximo}`,
    nota: notaFinal,
    puntosAprobacion: Math.round(puntosAprobacion * 10) / 10,
    puntosMaximos: puntajeTotalMaximo,
  }
}

interface EvaluationResponse {
  puntaje: string
  nota: number | string
  retroalimentacion: {
    resumen_general: { fortalezas: string; areas_mejora: string }
    detalle_puntaje_desarrollo: { [key: string]: any }
    correccion_detallada: { seccion: string; detalle: string }[]
    evaluacion_habilidades: { habilidad: string; evaluacion: string; evidencia: string }[]
    retroalimentacion_alternativas: { pregunta: string; respuesta_estudiante: string; respuesta_correcta: string }[]
  }
}

const validateEvaluationResponse = (obj: any): EvaluationResponse => {
  if (!obj || typeof obj !== "object" || !obj.puntaje || !obj.retroalimentacion) {
    throw new Error(
      "Invalid structure returned from AI model. Missing critical base fields (puntaje or retroalimentacion).",
    )
  }

  obj.retroalimentacion.detalle_puntaje_desarrollo = obj.retroalimentacion.detalle_puntaje_desarrollo || {}
  obj.retroalimentacion.correccion_detallada = obj.retroalimentacion.correccion_detallada || []
  obj.retroalimentacion.evaluacion_habilidades = obj.retroalimentacion.evaluacion_habilidades || []
  obj.retroalimentacion.retroalimentacion_alternativas = obj.retroalimentacion.retroalimentacion_alternativas || []

  obj.nota = typeof obj.nota === "number" ? obj.nota : 0.0

  return obj as EvaluationResponse
}

const cleanJson = (str: string): string => {
  let content = str.trim()
  const match = str.match(/```json\n([\s\S]*?)\n```/)

  if (match) {
    content = match[1].trim()
  } else {
    const start = content.indexOf("{")
    const end = content.lastIndexOf("}")

    if (start !== -1 && end !== -1 && end > start) {
      content = content.substring(start, end + 1)
      console.warn("CleanJson: Forzado el corte del contenido a los delimitadores JSON.")
    }

    try {
      JSON.parse(content)
    } catch (e) {
      content = content
        .replace(/(\r\n|\n|\r)/gm, " ")
        .replace(/\\/g, "\\\\")
        .replace(/([^\\])"/g, '$1\\"')
      console.warn("CleanJson: Aplicada reparación de caracteres forzada.")
    }
  }

  return content
}

const cleanUrlFromEnv = (url: string | undefined): string => {
  const defaultUrl = "https://api.mistral.ai/v1"
  if (!url) return defaultUrl

  let cleanedUrl = url.trim()

  const markdownMatch = cleanedUrl.match(/\[([^\]]+)\]$$([^)]+)$$/)
  if (markdownMatch && markdownMatch.length > 2) {
    cleanedUrl = markdownMatch[2]
  }

  cleanedUrl = cleanedUrl.replace(/['"`]/g, "").trim()

  if (!cleanedUrl.startsWith("http")) {
    cleanedUrl = "https://" + cleanedUrl
  }

  if (!cleanedUrl.endsWith("/v1")) {
    cleanedUrl = cleanedUrl.replace(/\/$/, "") + "/v1"
  }

  try {
    new URL(cleanedUrl)
    return cleanedUrl
  } catch {
    console.error("Fallo al validar la URL final del entorno. Usando valor seguro por defecto.")
    return defaultUrl
  }
}

export async function POST(req: NextRequest) {
  const MISTRAL_API_KEY_FINAL = process.env.MISTRAL_API_KEY
  const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_FINAL = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  const AZURE_DOCUMENT_INTELLIGENCE_KEY_FINAL = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY

  const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL_CORRUPTA || "https://api.mistral.ai/v1"
  const cleanedBaseUrl = cleanUrlFromEnv(MISTRAL_BASE_URL)

  if (!MISTRAL_API_KEY_FINAL || !AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_FINAL || !AZURE_DOCUMENT_INTELLIGENCE_KEY_FINAL) {
    console.error("ERROR CRÍTICO: Una o más claves de API son nulas. Verifique .env.local y reinicie el servidor.")
    return NextResponse.json(
      {
        success: false,
        error: "Error de configuración interna del servidor. Faltan claves de API. Verifique su archivo .env.local.",
      },
      { status: 500 },
    )
  }

  const openai = new OpenAI({
    apiKey: MISTRAL_API_KEY_FINAL,
    baseURL: cleanedBaseUrl,
  })
  const docIntelClient = new DocumentAnalysisClient(
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_FINAL, // Changed from AZURE_ENDPOINT to AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_FINAL
    new AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY_FINAL), // Changed from AZURE_KEY to AZURE_DOCUMENT_INTELLIGENCE_KEY_FINAL
  )

  try {
    const {
      fileUrls,
      rubrica,
      pauta,
      flexibilidad,
      areaConocimiento,
      puntajeTotal,
      porcentajeExigencia,
      pautaEstructurada,
      pautaCorrectaAlternativas: pautaAlternativasStr,
      itemsEsperados,
      nombreEstudiante,
      respuestasAlternativas,
      fileMimeTypes,
      captureMode,
      asignatura, // Added asignatura
    } = await req.json()

    const pautaCorrectaAlternativasMap = parsePautaAlternativas(pautaAlternativasStr || "")

    console.log("[v0] DEBUG - respuestasAlternativas recibidas:", respuestasAlternativas)

    if (!rubrica || !puntajeTotal || !pautaEstructurada) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan datos de configuración esenciales (rúbrica, puntaje total o pauta estructurada).",
        },
        { status: 400 },
      )
    }

    const itemScores = parsePautaEstructuradaItems(pautaEstructurada) // Changed function name
    let maxTotalScore = Number(puntajeTotal)

    const maxDesarrolloScore = itemScores.filter((i) => i.isDevelopment).reduce((sum, item) => sum + item.maxScore, 0)
    const maxScoreAlternativas = itemScores
      .filter((i) => !i.isDevelopment)
      .reduce((sum, item) => sum + item.maxScore, 0)

    // NO aplicar CFC automático si el profesor no puso alternativas
    if (maxScoreAlternativas === 0) {
      console.log("[v0] No hay alternativas en la pauta estructurada del profesor")
    }

    const calculatedMaxScore = maxDesarrolloScore + maxScoreAlternativas

    if (maxTotalScore !== calculatedMaxScore && calculatedMaxScore > 0) {
      console.warn(
        `[v0] ADVERTENCIA: Puntaje total (${maxTotalScore}) difiere de la suma de ítems (${calculatedMaxScore})`,
      )
      maxTotalScore = calculatedMaxScore
    }

    if (maxTotalScore === 0) {
      console.error("[v0] ERROR: Puntaje total es 0. Usar valor por defecto.")
      maxTotalScore = 100
    }

    const validFileUrls = fileUrls.filter((url: string) => url && url.length > 0)
    const fileBuffers = await Promise.all(
      validFileUrls.map(async (url: string, i: number) => {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        return {
          buffer: Buffer.from(arrayBuffer),
          mimeType: fileMimeTypes[i] || "application/octet-stream",
          captureMode,
        }
      }),
    )

    if (validFileUrls.length === 0) {
      const calculatedNote = calculateGrade(0, maxTotalScore, Number(porcentajeExigencia))
      return NextResponse.json(
        {
          success: true,
          puntaje: `0/${maxTotalScore}`,
          nota: calculatedNote,
          retroalimentacion: {
            resumen_general: {
              fortalezas: "Ningún archivo de respuesta enviado.",
              areas_mejora: "No se encontraron archivos válidos para evaluar.",
            },
            detalle_puntaje_desarrollo: {},
            correccion_detallada: [],
            evaluacion_habilidades: [],
            retroalimentacion_alternativas: [],
          },
        },
        { status: 200 },
      )
    }

    let aiResponse
    let finalResult: EvaluationResponse

    if (areaConocimiento === "artes") {
      const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"]
      const validImageUrls = validFileUrls.filter((_: string, i: number) =>
        imageMimeTypes.some((m) => fileMimeTypes[i]?.includes(m)),
      )
      const base64Images = await Promise.all(
        validImageUrls.map(async (url: string) => {
          const response = await fetch(url)
          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          return `data:image/jpeg;base64,${buffer.toString("base64")}`
        }),
      )

      if (base64Images.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Asignatura ARTES requiere imágenes (JPG/PNG/WEBP), pero no se encontraron archivos compatibles.",
          },
          { status: 400 },
        )
      }

      const getPrompt = promptsExpertos.artes
      const prompt = (getPrompt as typeof promptsExpertos.artes)(
        rubrica,
        pauta,
        maxTotalScore,
        flexibilidad,
        itemScores,
        nombreEstudiante,
        respuestasAlternativas,
        pautaCorrectaAlternativasMap,
      )

      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: prompt },
            ...base64Images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        },
      ]

      aiResponse = await openai.chat.completions.create({
        model: "mistral-large-latest",
        messages: messages as any,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000,
      })
    } else {
      const textoExtraido = await extractTextFromFiles(fileBuffers, docIntelClient)

      if (textoExtraido === "NO SE PUDO EXTRAER TEXTO.") {
        return NextResponse.json(
          {
            success: false,
            error: "No se pudo extraer texto del archivo subido. Asegúrese de que no esté protegido o sea ilegible.",
          },
          { status: 400 },
        )
      }

      const getPrompt = promptsExpertos[areaConocimiento as keyof typeof promptsExpertos] || promptsExpertos.general
      const prompt = (getPrompt as typeof promptsExpertos.general)(
        textoExtraido,
        rubrica,
        pauta,
        maxTotalScore,
        flexibilidad,
        itemScores,
        nombreEstudiante,
        respuestasAlternativas,
        pautaCorrectaAlternativasMap,
      )

      aiResponse = await openai.chat.completions.create({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000,
      })
    }

    const content = aiResponse.choices[0].message.content
    if (!content) {
      return NextResponse.json({ success: false, error: "La IA no devolvió contenido de evaluación." }, { status: 500 })
    }
    const cleanedContent = cleanJson(content)
    let resultado
    try {
      resultado = JSON.parse(cleanedContent)
    } catch (error) {
      console.error("Error al parsear JSON:", error)
      return NextResponse.json(
        { success: false, error: "La respuesta de la IA no es un JSON válido." },
        { status: 500 },
      )
    }
    finalResult = validateEvaluationResponse(resultado)

    let scoreAlternativasObtenido = 0
    let scoreDesarrolloObtenido = 0

    const alternativasExtraidas = finalResult.retroalimentacion.retroalimentacion_alternativas || []

    let alternativasFinales = alternativasExtraidas

    if (
      respuestasAlternativas &&
      typeof respuestasAlternativas === "object" &&
      Object.keys(respuestasAlternativas).length > 0
    ) {
      console.log("[v0] USANDO alternativas corregidas del frontend (OMR manual)")

      // Convertir el objeto en array
      alternativasFinales = Object.entries(respuestasAlternativas).map(([pregunta, respuesta]) => {
        const correcta = pautaCorrectaAlternativasMap[pregunta] || ""
        const respuestaUpper = String(respuesta).trim().toUpperCase()
        const correctaUpper = correcta.trim().toUpperCase()

        return {
          pregunta: pregunta,
          respuesta_estudiante: String(respuesta),
          respuesta_correcta: correcta,
          confidence: "high" as const,
        }
      })

      // Actualizar el resultado final con las alternativas manuales
      finalResult.retroalimentacion.retroalimentacion_alternativas = alternativasFinales
    }

    const alternativaScores = itemScores.filter((i) => !i.isDevelopment)

    const seenAlternativas = new Set<string>()

    for (const alt of alternativasFinales) {
      const preguntaId = alt.pregunta.trim().toUpperCase()

      if (seenAlternativas.has(preguntaId)) {
        console.log("[v0] Alternativa duplicada eliminada:", preguntaId)
        continue
      }
      seenAlternativas.add(preguntaId)

      const { text: filteredExtraida, confidence } = applyRFMText(
        alt.respuesta_estudiante || "",
        preguntaId,
        fileBuffers[0]?.captureMode,
      )

      const itemMatch = alternativaScores.find((scoreItem) => {
        const scoreIdUpper = scoreItem.id.trim().toUpperCase()
        return scoreIdUpper === preguntaId || scoreIdUpper.includes(preguntaId) || preguntaId.includes(scoreIdUpper)
      })

      let maxItemScore = 1

      if (itemMatch) {
        maxItemScore = itemMatch.maxScore
      }

      const correcta = pautaCorrectaAlternativasMap[itemMatch?.id || preguntaId]
        ? pautaCorrectaAlternativasMap[itemMatch?.id || preguntaId].trim().toUpperCase()
        : ""

      alt.respuesta_estudiante = filteredExtraida
      ;(alt as any).confidence = confidence

      if (correcta && filteredExtraida && correcta === filteredExtraida) {
        scoreAlternativasObtenido += maxItemScore
      }
    }

    const desarrolloItemsCorregidos = finalResult.retroalimentacion.detalle_puntaje_desarrollo || {}

    console.log("[v0] DEBUG ARTES - desarrolloItemsCorregidos:", JSON.stringify(desarrolloItemsCorregidos, null, 2))
    console.log("[v0] DEBUG ARTES - itemScores:", JSON.stringify(itemScores, null, 2))

    const seenDesarrollo = new Set<string>()

    for (const itemId in desarrolloItemsCorregidos) {
      if (seenDesarrollo.has(itemId)) {
        console.log("[v0] Desarrollo duplicado eliminado:", itemId)
        continue
      }
      seenDesarrollo.add(itemId)

      const item = desarrolloItemsCorregidos[itemId]

      console.log("[v0] DEBUG ARTES - Procesando itemId:", itemId)
      console.log("[v0] DEBUG ARTES - item:", JSON.stringify(item, null, 2))

      if (item.puntaje && typeof item.puntaje === "string") {
        const match = item.puntaje.match(/^(\d+)\/(\d+)$/)
        if (match) {
          const puntajeObtenido = Number.parseInt(match[1], 10) || 0
          const puntajeMaximo = Number.parseInt(match[2], 10) || 0

          console.log("[v0] DEBUG ARTES - puntajeObtenido extraído:", puntajeObtenido)
          console.log("[v0] DEBUG ARTES - puntajeMaximo extraído:", puntajeMaximo)

          scoreDesarrolloObtenido += puntajeObtenido
        } else {
          console.log("[v0] DEBUG ARTES - No se pudo parsear puntaje:", item.puntaje)
        }
      } else {
        console.log("[v0] DEBUG ARTES - item.puntaje no es string o está vacío")
      }
    }

    const finalScore = scoreAlternativasObtenido + scoreDesarrolloObtenido

    console.log("[v0] DEBUG PUNTAJE - Alternativas:", scoreAlternativasObtenido)
    console.log("[v0] DEBUG PUNTAJE - Desarrollo:", scoreDesarrolloObtenido)
    console.log("[v0] DEBUG PUNTAJE - Total:", finalScore, "/", maxTotalScore)
    console.log("[v0] DEBUG ARTES - areaConocimiento:", areaConocimiento)
    console.log("[v0] DEBUG ARTES - porcentajeExigencia:", porcentajeExigencia)
    console.log("[v0] DEBUG ARTES - finalScore:", finalScore)
    console.log("[v0] DEBUG ARTES - maxTotalScore:", maxTotalScore)

    finalResult.puntaje = `${finalScore}/${maxTotalScore}`

    // Removed the 'if' that prevented grade calculation for Artes. Now it calculates normally.
    finalResult.nota = calculateGrade(finalScore, maxTotalScore, Number(porcentajeExigencia))

    console.log("[v0] DEBUG ARTES - nota calculada:", finalResult.nota)

    const exigenciaDecimal = Math.min(100, Number(porcentajeExigencia)) / 100
    const puntosAprobacionCalculados = Math.ceil(maxTotalScore * exigenciaDecimal)

    return NextResponse.json({
      success: true,
      puntaje: finalResult.puntaje,
      nota: finalResult.nota,
      puntosAprobacion: puntosAprobacionCalculados,
      puntosMaximos: maxTotalScore,
      alternativas_corregidas: finalResult.retroalimentacion.retroalimentacion_alternativas,
      detalle_desarrollo: finalResult.retroalimentacion.detalle_puntaje_desarrollo,
      retroalimentacion: finalResult.retroalimentacion,
      // Removed the 'esArtes' field as Artes is now evaluated the same as other subjects.
    })
  } catch (error) {
    console.error("Error en la evaluación:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor. Por favor, intente de nuevo más tarde." },
      { status: 500 },
    )
  }
}
