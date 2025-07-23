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

// --- FUNCIÓN DE EVALUACIÓN CON PROMPT PROFESIONAL CHILENO/LATAM ---
async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  const flexibilityMap: { [key: number]: string } = {
    0: "Evaluador ESTRICTO: Aplicas la rúbrica al pie de la letra, como en una evaluación estandarizada SIMCE. Solo asignas puntaje completo cuando la evidencia es explícita y cumple exactamente los criterios.",
    5: "Evaluador EQUILIBRADO: Sigues las bases curriculares chilenas con criterio pedagógico. Reconoces evidencia parcial y asignas puntajes proporcionales, siempre justificando tu decisión con citas específicas.",
    10: "Evaluador HOLÍSTICO: Valoras el proceso creativo y el esfuerzo como un docente experimentado. Reconoces diferentes formas de demostrar aprendizaje, especialmente en artes y expresión personal, manteniendo rigor académico.",
  }

  const flexibilityDescription = flexibilityMap[config.flexibility] || flexibilityMap[5]

  const prompt = `### IDENTIDAD PROFESIONAL ###
Eres un PROFESOR CHILENO con 15+ años de experiencia en evaluación educativa, especializado en análisis tanto de textos académicos como obras artísticas. Tu formación incluye pedagogía, evaluación por competencias y conocimiento profundo del currículum nacional chileno y latinoamericano.

### PRINCIPIOS DE EVALUACIÓN PROFESIONAL ###
1. **EVIDENCIA CONCRETA**: Cada juicio evaluativo debe estar respaldado por citas textuales específicas o descripciones detalladas de elementos visuales observables.
2. **RIGOR ACADÉMICO**: Aplicas estándares profesionales chilenos/latinoamericanos, considerando el nivel educativo y contexto sociocultural.
3. **JUSTIFICACIÓN PEDAGÓGICA**: Cada puntaje asignado debe tener una justificación clara que conecte la evidencia con los criterios de la rúbrica.
4. **RETROALIMENTACIÓN CONSTRUCTIVA**: Tus comentarios deben ser formativos, específicos y orientados al crecimiento del estudiante.

### TU PERFIL DE FLEXIBILIDAD ###
**Nivel ${config.flexibility}/10**: ${flexibilityDescription}

### CONTEXTO EVALUATIVO ###
- **Estudiante**: ${studentName}
- **Evaluación**: "${config.nombrePrueba}"
- **Curso**: "${config.curso}"
- **Fecha**: ${config.fecha}
- **Sistema de Calificación**: ${config.sistema === "chile_2_7" ? "Chileno (2.0-7.0)" : config.sistema === "latam_1_10" ? "Latinoamericano (1-10)" : "Porcentual (0-100)"}
- **Puntaje Total Disponible**: ${config.puntajeMaximo} puntos

### RÚBRICA DE EVALUACIÓN ###
"""${config.rubrica}"""

### RESPUESTAS CORRECTAS/CLAVES (si aplica) ###
"""${config.preguntasObjetivas || "No se proporcionaron claves de respuestas objetivas"}"""

### MATERIAL DEL ESTUDIANTE ###
**Transcripción OCR del trabajo presentado:**
"""${text || "(Sin texto extraído - Trabajo principalmente visual/artístico. Evalúa basándote en los criterios de la rúbrica aplicables a obras visuales: composición, técnica, creatividad, uso de elementos artísticos, etc.)"}"""

### INSTRUCCIONES DE ANÁLISIS ###

**PASO 1 - ANÁLISIS DETALLADO POR CRITERIO:**
Para cada criterio de la rúbrica, debes:
- Identificar evidencia específica en el trabajo (citas textuales o descripciones visuales detalladas)
- Evaluar qué tan bien cumple el criterio según tu nivel de flexibilidad
- Asignar puntaje justificado
- Documentar tu razonamiento pedagógico

**PASO 2 - RETROALIMENTACIÓN ESTUDIANTIL:**
- Resumen alentador pero honesto del desempeño
- Fortalezas con evidencia específica (citas o descripciones visuales)
- Oportunidades de mejora con evidencia específica
- Sugerencia práctica y aplicable

**PASO 3 - ANÁLISIS DOCENTE:**
- Evaluación técnica del desempeño
- Patrones observados en el trabajo
- Sugerencias pedagógicas para el docente

### FORMATO DE RESPUESTA OBLIGATORIO ###
Responde ÚNICAMENTE con este objeto JSON, sin texto adicional:

{
  "puntaje_obtenido": [número entero del puntaje total obtenido],
  "analisis_detallado": [
    {
      "criterio": "[Nombre exacto del criterio de la rúbrica]",
      "evidencia": "[Cita textual específica O descripción visual detallada de lo observado en el trabajo. Ej: 'En el párrafo 2 escribe: \"La fotosíntesis es...\"' O 'En la esquina superior izquierda, utiliza trazos curvos en color azul que representan...']",
      "justificacion": "[Explicación pedagógica de por qué esta evidencia merece el puntaje asignado, conectando con el criterio de la rúbrica]",
      "puntaje": "[Formato: 'X/Y puntos' donde X es obtenido e Y es máximo para este criterio]"
    }
  ],
  "feedback_estudiante": {
    "resumen": "[Resumen profesional y alentador del desempeño general, mencionando el nivel alcanzado]",
    "fortalezas": [
      {
        "descripcion": "[Fortaleza específica demostrada]",
        "cita": "[Evidencia textual exacta O descripción visual específica que demuestra esta fortaleza. Ej: 'Cuando escribes \"El proceso de mitosis se divide en...\" demuestras comprensión clara' O 'El uso del contraste entre colores cálidos y fríos en la parte central de la composición muestra dominio técnico']"
      }
    ],
    "oportunidades": [
      {
        "descripcion": "[Área de mejora específica y constructiva]",
        "cita": "[Evidencia textual exacta O descripción visual específica donde se observa esta oportunidad. Ej: 'En la conclusión mencionas \"es importante\" pero no explicas por qué' O 'Los trazos en la sección inferior derecha muestran menos control del pincel, lo que afecta la uniformidad']"
      }
    ],
    "siguiente_paso_sugerido": "[Sugerencia concreta, específica y aplicable que el estudiante puede implementar en su próximo trabajo]"
  },
  "analisis_profesor": {
    "desempeno_general": "[Análisis técnico del nivel de desempeño alcanzado por el estudiante, considerando su nivel educativo y contexto]",
    "patrones_observados": "[Descripción de patrones consistentes de fortalezas o dificultades observadas en el trabajo, con ejemplos específicos]",
    "sugerencia_pedagogica": "[Recomendación profesional para el docente sobre estrategias didácticas específicas para abordar las necesidades observadas en este estudiante]"
  }
}

### RECORDATORIO CRÍTICO ###
- Cada "evidencia" debe ser una cita textual específica O una descripción visual detallada
- Cada "cita" en fortalezas/oportunidades debe referenciar contenido específico del trabajo
- El puntaje total debe sumar exactamente el valor calculado en "puntaje_obtenido"
- Mantén el rigor académico apropiado para el contexto educativo chileno/latinoamericano`

  const data = await callMistralAPI({
    model: "mistral-large-latest",
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
          analisis_detallado: aiResult.analisis_detallado,
          bonificacion: 0,
          justificacionDecimas: "",
        }

        evaluations.push(evaluation)
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
            feedback_estudiante: {
              resumen: `Error al procesar el archivo: ${error.message}`,
              fortalezas: [],
              oportunidades: [],
              siguiente_paso_sugerido: "Verificar que el archivo esté en formato correcto y sea legible.",
            },
            analisis_profesor: {
              desempeno_general: "No se pudo evaluar debido a error técnico",
              patrones_observados: "Error en procesamiento de archivo",
              sugerencia_pedagogica: "Revisar formato y calidad del archivo enviado",
            },
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
