import { type NextRequest, NextResponse } from "next/server"

// --- INTERFACES Y FUNCIONES AUXILIARES ---
interface EvaluationConfig {
  sistema: string
  nivelExigencia: number
  puntajeMaximo: number
  notaAprobacion: number
  flexibility: number
  fecha: string
  nombrePrueba: string
  curso: string
  rubrica: string
  preguntasObjetivas: string
  aiModel: string // Nueva propiedad
}

function calculateFinalGrade(
  puntajeObtenido: number,
  puntajeMax: number,
  sistema: string,
  exigencia: number,
  notaAprobacion: number,
) {
  if (puntajeMax <= 0) return sistema === "chile_2_7" ? 2.0 : 0
  const porcentaje = puntajeObtenido / puntajeMax

  if (sistema === "chile_2_7") {
    const pExigencia = exigencia / 100
    const notaMax = 7.0
    const notaMin = 2.0
    let nota

    if (porcentaje >= pExigencia) {
      nota = notaAprobacion + (notaMax - notaAprobacion) * ((porcentaje - pExigencia) / (1 - pExigencia))
    } else {
      nota = notaMin + (notaAprobacion - notaMin) * (porcentaje / pExigencia)
    }
    return Math.min(notaMax, Math.max(notaMin, Math.round(nota * 10) / 10))
  } else if (sistema === "latam_1_10") {
    return Math.min(10.0, 1.0 + 9.0 * porcentaje)
  } else if (sistema === "porcentual_0_100") {
    return Math.min(100.0, 100.0 * porcentaje)
  }
  return 0
}

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

  const prompt = `Como profesor chileno experto, analiza esta transcripción de documento estudiantil y extrae únicamente el nombre completo del estudiante. Busca patrones típicos como "Nombre:", "Alumno/a:", "Estudiante:", etc. Corrige errores obvios de OCR (ej: "Jvan" → "Iván", "Mana" → "María"). Responde SOLO con el nombre completo o cadena vacía si no lo encuentras.

Texto: """${text}"""`

  const data = await callMistralAPI({
    model: "mistral-tiny",
    messages: [{ role: "user", content: prompt }],
  })

  return data.choices[0].message.content.trim()
}

// --- FUNCIÓN DE EVALUACIÓN ULTRA-ESPECÍFICA MEJORADA ---
async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  const flexibilityMap: { [key: number]: string } = {
    0: "Evaluador ULTRA-ESTRICTO: Como corrector de PSU/PAES, solo reconoces evidencia explícita y perfectamente ejecutada. Cada décima debe estar completamente justificada.",
    5: "Evaluador PROFESIONAL EQUILIBRADO: Aplicas criterios pedagógicos rigurosos pero reconoces el proceso creativo. Valoras tanto la técnica como la intención artística, siempre con evidencia específica.",
    10: "Evaluador HOLÍSTICO EXPERTO: Como crítico de arte experimentado, reconoces múltiples formas de expresión y valoras la originalidad, el riesgo creativo y la evolución personal del estudiante.",
  }

  const flexibilityDescription = flexibilityMap[config.flexibility] || flexibilityMap[5]

  const prompt = `### IDENTIDAD PROFESIONAL ULTRA-ESPECÍFICA ###
Eres PROFESOR MIGUEL HERNÁNDEZ, docente chileno con 20 años de experiencia en evaluación de artes visuales y textos académicos. Has sido capacitado en:
- Análisis crítico de obras visuales (pintura, dibujo, collage, fotografía)
- Evaluación de textos académicos con metodología chilena
- Identificación de habilidades específicas del siglo XXI
- Retroalimentación formativa basada en evidencia concreta

### TU METODOLOGÍA DE ANÁLISIS ULTRA-DETALLADA ###
**Nivel de Rigurosidad**: ${config.flexibility}/10 - ${flexibilityDescription}

**PARA OBRAS VISUALES, DEBES ANALIZAR:**
- **Técnica**: Tipo de trazos, presión, control del instrumento, limpieza
- **Composición**: Distribución espacial, equilibrio, jerarquía visual, uso del espacio
- **Color**: Paleta cromática, armonías, contrastes, saturación, temperatura
- **Contenido**: Mensaje, simbolismo, narrativa visual, coherencia temática
- **Originalidad**: Creatividad, riesgo artístico, propuesta personal

**PARA TEXTOS, DEBES ANALIZAR:**
- **Estructura**: Organización, coherencia, progresión lógica
- **Contenido**: Profundidad, precisión conceptual, ejemplificación
- **Lenguaje**: Registro, vocabulario, corrección gramatical
- **Argumentación**: Solidez, evidencia, contraargumentos
- **Originalidad**: Perspectiva personal, creatividad en el enfoque

### CONTEXTO EVALUATIVO ###
- **Estudiante**: ${studentName}
- **Evaluación**: "${config.nombrePrueba}"
- **Curso**: "${config.curso}"
- **Sistema**: ${config.sistema === "chile_2_7" ? "Chileno (2.0-7.0)" : config.sistema === "latam_1_10" ? "Latinoamericano (1-10)" : "Porcentual (0-100)"}
- **Puntaje Total**: ${config.puntajeMaximo} puntos

### RÚBRICA DE EVALUACIÓN ###
"""${config.rubrica}"""

### CLAVES DE RESPUESTAS CORRECTAS ###
"""${config.preguntasObjetivas || "No se proporcionaron respuestas correctas específicas"}"""

### MATERIAL DEL ESTUDIANTE ###
**Transcripción/Descripción del trabajo:**
"""${text || "(Trabajo principalmente visual - Analiza basándote en elementos observables: composición, técnica, uso del color, mensaje visual, creatividad, etc.)"}"""

### INSTRUCCIONES CRÍTICAS PARA RETROALIMENTACIÓN ULTRA-ESPECÍFICA ###

**OBLIGATORIO - CADA COMENTARIO DEBE INCLUIR:**
1. **UBICACIÓN ESPECÍFICA**: "En la esquina superior derecha...", "En el párrafo 3, línea 2...", "En el centro de la composición..."
2. **DESCRIPCIÓN TÉCNICA DETALLADA**: Colores exactos, tipos de trazos, técnicas utilizadas
3. **ANÁLISIS PEDAGÓGICO**: Por qué es fortaleza o debilidad según criterios académicos
4. **HABILIDADES IDENTIFICADAS**: Qué competencias específicas demuestra o necesita desarrollar

### FORMATO DE RESPUESTA OBLIGATORIO ###
Responde ÚNICAMENTE con este JSON, sin texto adicional:
{
  "puntaje_obtenido": [número entero],
  "habilidades_identificadas": {
    "[Nombre de habilidad específica]": {
      "nivel": "[Destacado/Competente/En desarrollo/Inicial]",
      "evidencia_especifica": "[Descripción ultra-detallada de dónde y cómo se observa esta habilidad en el trabajo]",
      "justificacion_pedagogica": "[Explicación de por qué esta evidencia demuestra este nivel de la habilidad]"
    }
  },
  "analisis_detallado": [
    {
      "criterio": "[Criterio exacto de la rúbrica]",
      "evidencia": "[Descripción ultra-específica con ubicación exacta y detalles técnicos observables]",
      "justificacion": "[Análisis pedagógico detallado conectando evidencia con criterio y nivel de logro]",
      "puntaje": "[X/Y puntos]"
    }
  ],
  "feedback_estudiante": {
    "resumen": "[Análisis profesional del desempeño general, mencionando nivel alcanzado y aspectos más destacados]",
    "fortalezas": [
      {
        "descripcion": "[Fortaleza específica con nombre técnico preciso]",
        "cita": "[Ubicación exacta + descripción técnica detallada + análisis de por qué es una fortaleza. Mínimo 2 oraciones completas con detalles específicos]",
        "habilidad_demostrada": "[Qué habilidad específica evidencia esta fortaleza]"
      }
    ],
    "oportunidades": [
      {
        "descripcion": "[Área de mejora específica con terminología técnica apropiada]",
        "cita": "[Ubicación exacta + descripción técnica detallada + análisis de qué falta o cómo mejorar. Mínimo 2 oraciones completas con detalles específicos]",
        "habilidad_a_desarrollar": "[Qué habilidad específica necesita fortalecer]",
        "sugerencia_tecnica": "[Consejo técnico específico y aplicable para mejorar]"
      }
    ],
    "siguiente_paso_sugerido": "[Sugerencia ultra-específica con pasos concretos, técnicas específicas a practicar, y recursos recomendados]"
  },
  "analisis_profesor": {
    "desempeno_general": "[Análisis técnico profesional del nivel alcanzado, comparando con estándares curriculares chilenos]",
    "patrones_observados": "[Descripción detallada de patrones consistentes con ejemplos específicos de ubicaciones en el trabajo]",
    "sugerencia_pedagogica": "[Estrategias didácticas específicas, recursos recomendados, y enfoques metodológicos para abordar las necesidades identificadas]",
    "proyeccion_desarrollo": "[Análisis del potencial del estudiante y áreas prioritarias para su desarrollo futuro]"
  }
}`

  const data = await callMistralAPI({
    model: config.aiModel, // Usar el modelo seleccionado por el usuario
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  })

  try {
    const parsed = JSON.parse(data.choices[0].message.content)
    if (typeof parsed.puntaje_obtenido === "undefined" || !parsed.feedback_estudiante) {
      throw new Error("La respuesta de la IA no tiene el formato JSON esperado.")
    }
    return parsed
  } catch (e) {
    throw new Error(`Respuesta JSON inválida de la IA: ${data.choices[0].message.content}`)
  }
}

// --- FUNCIÓN PRINCIPAL POST ---
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const configStr = formData.get("config") as string
    const config: EvaluationConfig = JSON.parse(configStr)

    if (!files.length) {
      return NextResponse.json({ success: false, error: "No files provided" })
    }

    const evaluations = []

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        let extractedText = ""

        if (file.type.startsWith("image/") || file.name.endsWith(".pdf")) {
          extractedText = await ocrAzure(buffer)
        } else if (file.name.endsWith(".txt")) {
          extractedText = await file.text()
        }

        const studentName = (await extractNameWithAI(extractedText)) || `Estudiante_${file.name.split(".")[0]}`
        const aiResult = await evaluateWithAI(extractedText, config, studentName)

        const finalGrade = calculateFinalGrade(
          aiResult.puntaje_obtenido,
          config.puntajeMaximo,
          config.sistema,
          config.nivelExigencia,
          config.notaAprobacion,
        )

        const evaluation = {
          id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nombreEstudiante: studentName,
          nombrePrueba: config.nombrePrueba,
          curso: config.curso,
          notaFinal: finalGrade,
          puntajeObtenido: aiResult.puntaje_obtenido,
          configuracion: config,
          feedback_estudiante: aiResult.feedback_estudiante,
          analisis_profesor: aiResult.analisis_profesor,
          habilidades_identificadas: aiResult.habilidades_identificadas,
          analisis_detallado: aiResult.analisis_detallado,
        }

        evaluations.push(evaluation as any)
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        if (error instanceof Error) {
          const evaluationError = {
            id: `error_${Date.now()}`,
            nombreEstudiante: `Error en archivo ${file.name}`,
            nombrePrueba: config.nombrePrueba,
            curso: config.curso,
            notaFinal: 1.0,
            puntajeObtenido: 0,
            configuracion: config,
            feedback_estudiante: { resumen: `Error procesando archivo: ${error.message}` },
            analisis_profesor: { desempeno_general: "Error en procesamiento" },
            habilidades_identificadas: {},
            analisis_detallado: [],
          }
          evaluations.push(evaluationError as any)
        }
      }
    }

    return NextResponse.json({ success: true, evaluations })
  } catch (error) {
    console.error("Evaluation error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}
