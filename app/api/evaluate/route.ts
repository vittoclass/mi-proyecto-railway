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

**EJEMPLO DE RETROALIMENTACIÓN ESPECÍFICA CORRECTA:**
❌ MAL: "Buen uso del color"
✅ BIEN: "En la sección central de tu obra, el contraste entre el azul cobalto y el naranja cadmio crea un punto focal efectivo que dirige la mirada del espectador hacia el elemento principal. Esta decisión cromática demuestra comprensión de la teoría del color complementario y habilidad para jerarquizar elementos visuales."

**HABILIDADES QUE DEBES IDENTIFICAR Y EVALUAR:**
- **Técnicas Artísticas**: Manejo de materiales, control motor fino, aplicación de técnicas específicas
- **Pensamiento Crítico**: Análisis, síntesis, evaluación de información
- **Creatividad**: Originalidad, fluidez de ideas, flexibilidad conceptual
- **Comunicación Visual**: Claridad del mensaje, uso de símbolos, narrativa visual
- **Competencias Disciplinares**: Conocimiento específico del área (historia del arte, conceptos científicos, etc.)
- **Metacognición**: Reflexión sobre el propio proceso creativo/académico

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
}

### EJEMPLOS DE ESPECIFICIDAD REQUERIDA ###

**Para Obra Visual:**
- "En el tercio superior izquierdo de tu composición, utilizas trazos verticales con lápiz 2B que crean una textura rugosa efectiva para representar la corteza del árbol. La presión variable que aplicas (más intensa en la base, más suave hacia las ramas) demuestra control técnico del grafito y comprensión de cómo crear volumen mediante valores tonales."

**Para Texto Académico:**
- "En tu segundo párrafo, cuando escribes 'La fotosíntesis permite que las plantas conviertan la luz solar en energía química', demuestras comprensión del concepto básico. Sin embargo, la explicación se queda en un nivel superficial ya que no mencionas los reactivos específicos (CO2 + H2O) ni los productos (glucosa + O2), lo que limitaría tu puntaje en el criterio de 'precisión científica'."

### RECORDATORIO FINAL ###
- CERO generalidades o comentarios vagos
- CADA observación debe tener ubicación específica
- CADA fortaleza/oportunidad debe incluir análisis técnico detallado
- IDENTIFICA habilidades específicas del siglo XXI
- USA terminología técnica apropiada para el nivel educativo
- CONECTA cada observación con criterios pedagógicos chilenos/latinoamericanos`

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
          habilidades_identificadas: aiResult.habilidades_identificadas,
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
              resumen: `Error técnico al procesar el archivo: ${error.message}. Verifica que el archivo esté en formato correcto (JPG, PNG, PDF) y sea legible.`,
              fortalezas: [],
              oportunidades: [
                {
                  descripcion: "Resolución de problema técnico",
                  cita: "El archivo no pudo ser procesado correctamente por el sistema OCR. Esto puede deberse a baja calidad de imagen, formato no compatible, o texto ilegible.",
                  habilidad_a_desarrollar: "Competencia digital",
                  sugerencia_tecnica:
                    "Asegúrate de que las imágenes tengan buena resolución (mínimo 300 DPI), buen contraste, y texto claramente legible.",
                },
              ],
              siguiente_paso_sugerido:
                "Vuelve a subir el archivo asegurándote de que esté en formato JPG, PNG o PDF, con texto legible y buena calidad de imagen.",
            },
            analisis_profesor: {
              desempeno_general: "No se pudo evaluar debido a error técnico en el procesamiento del archivo",
              patrones_observados:
                "Error sistemático en la lectura del archivo, posiblemente por formato o calidad inadecuada",
              sugerencia_pedagogica:
                "Proporcionar instrucciones claras a los estudiantes sobre formatos de archivo aceptables y calidad mínima requerida",
              proyeccion_desarrollo:
                "Una vez resuelto el problema técnico, se podrá realizar la evaluación correspondiente",
            },
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
