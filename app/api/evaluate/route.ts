import { type NextRequest, NextResponse } from "next/server"

// --- TUS FUNCIONES ORIGINALES (SIN CAMBIOS) ---

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

async function callMistralAPI(payload: any) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY no está configurada en las variables de entorno")
  }

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Mistral API error: ${data.error?.message || response.statusText}`)
  }
  return data
}

async function ocrAzure(file: Buffer) {
  const azureKey = process.env.AZURE_VISION_KEY
  const azureEndpoint = process.env.AZURE_VISION_ENDPOINT

  if (!azureKey || !azureEndpoint) {
    throw new Error("AZURE_VISION_KEY o AZURE_VISION_ENDPOINT no están configuradas")
  }

  const response = await fetch(`${azureEndpoint}vision/v3.2/ocr?language=es`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azureKey,
      "Content-Type": "application/octet-stream",
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error(`Azure OCR error: ${response.statusText}`)
  }

  const data = await response.json()
  return (
    data.regions
      ?.flatMap((reg: any) => reg.lines.map((l: any) => l.words.map((w: any) => w.text).join(" ")))
      .join("\n") || ""
  )
}

async function extractNameWithAI(text: string) {
  if (!text.trim()) return ""

  const prompt = `Analiza el siguiente texto y extrae el nombre completo de la persona. Busca patrones como 'Nombre:', 'Alumno:', etc. Corrige errores obvios de OCR. Devuelve solo el nombre. Si no encuentras un nombre, responde con una cadena vacía.

Texto: """${text}"""`

  const data = await callMistralAPI({
    model: "mistral-tiny",
    messages: [{ role: "user", content: prompt }],
  })

  return data.choices[0].message.content.trim()
}

async function evaluateWithAI(text: string, config: EvaluationConfig, studentName: string) {
  const flexibilityMap: { [key: number]: string } = {
    0: "Eres un evaluador extremadamente RÍGIDO y LITERAL. Te ciñes 100% a la rúbrica.",
    5: "Eres un evaluador EQUILIBRADO. Te basas en la rúbrica pero puedes asignar puntajes parciales.",
    10: "Eres un evaluador muy FLEXIBLE y HOLÍSTICO. Valoras la creatividad y el esfuerzo.",
  }

  const flexibilityDescription = flexibilityMap[config.flexibility] || flexibilityMap[5]

  const prompt = `### PERFIL: DOCENTE-EVALUADOR EXPERTO ###
Actúas como un profesor chileno experto en evaluación formativa.

### NIVEL DE FLEXIBILIDAD ###
Tu nivel de flexibilidad es **${config.flexibility}/10**: ${flexibilityDescription}

### CONTEXTO DE LA EVALUACIÓN ###
- Estudiante: "${studentName}"
- Evaluación: "${config.nombrePrueba}"
- Curso: "${config.curso}"
- Rúbrica: """${config.rubrica}"""
- Preguntas Objetivas: """${config.preguntasObjetivas}"""
- Puntaje Máximo: ${config.puntajeMaximo}

### MATERIAL DEL ESTUDIANTE ###
${text || "(Sin texto extraído - El trabajo es puramente visual)"}

### TAREAS ###
1. Evalúa según la rúbrica y preguntas objetivas
2. Calcula el puntaje total obtenido
3. Analiza habilidades demostradas
4. Genera feedback constructivo
5. Proporciona análisis detallado

Responde ÚNICAMENTE con un objeto JSON válido:
{
  "puntaje_obtenido": 0,
  "analisis_habilidades": {
    "Habilidad Ejemplo": {
      "nivel": "Logrado",
      "justificacion_con_cita": "Justificación con evidencia"
    }
  },
  "feedback_estudiante": {
    "resumen": "Resumen general del desempeño",
    "fortalezas": [
      {
        "descripcion": "Descripción de la fortaleza",
        "cita": "Evidencia del trabajo"
      }
    ],
    "oportunidades": [
      {
        "descripcion": "Área de mejora",
        "cita": "Evidencia específica"
      }
    ],
    "siguiente_paso_sugerido": "Sugerencia específica para mejorar"
  },
  "analisis_profesor": {
    "desempeno_general": "Análisis general del desempeño",
    "patrones_observados": [
      {
        "descripcion": "Patrón observado",
        "cita": "Evidencia"
      }
    ],
    "sugerencia_pedagogica": "Sugerencia para el docente"
  },
  "analisis_detallado": [
    {
      "criterio": "Nombre del criterio",
      "evidencia": "Evidencia encontrada",
      "justificacion": "Justificación del puntaje",
      "puntaje": "X/Y puntos"
    }
  ]
}`

  const data = await callMistralAPI({
    model: "mistral-large-latest",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  })

  try {
    const parsed = JSON.parse(data.choices[0].message.content)
    if (typeof parsed.puntaje_obtenido === "undefined" || !parsed.feedback_estudiante) {
      throw new Error("Invalid AI response format")
    }
    return parsed
  } catch (e) {
    throw new Error(`Invalid JSON response from AI: ${data.choices[0].message.content}`)
  }
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
    const porcentajeExigencia = exigencia / 100
    const notaMaxima = 7.0
    const notaMinima = 2.0
    let nota

    if (porcentaje >= porcentajeExigencia) {
      nota =
        notaAprobacion +
        (notaMaxima - notaAprobacion) * ((porcentaje - porcentajeExigencia) / (1 - porcentajeExigencia))
    } else {
      nota = notaMinima + (notaAprobacion - notaMinima) * (porcentaje / porcentajeExigencia)
    }
    return Math.min(notaMaxima, Math.max(notaMinima, Math.round(nota * 10) / 10))
  } else if (sistema === "latam_1_10") {
    return Math.min(10.0, 1.0 + 9.0 * porcentaje)
  } else if (sistema === "porcentual_0_100") {
    return Math.min(100.0, 100.0 * porcentaje)
  }
  return 0
}

// --- FUNCIÓN PRINCIPAL POST (MODIFICADA PARA LA PRUEBA) ---

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const configStr = formData.get("config") as string
    const config: EvaluationConfig = JSON.parse(configStr)

    console.log("API /api/evaluate RECIBIÓ LA LLAMADA. Omitiendo IA para depurar.");

    // --- INICIO DEL CÓDIGO DE PRUEBA ---
    // En lugar de procesar los archivos, creamos una respuesta falsa.
    const fakeEvaluationResult = {
      success: true,
      evaluations: [
        {
          id: "test-123",
          nombreEstudiante: "Estudiante de Prueba Exitosa",
          nombrePrueba: config.nombrePrueba || "Ensayo de Depuración",
          curso: config.curso || "Informática 101",
          notaFinal: 6.5,
          puntajeObtenido: 25,
          configuracion: config,
          feedback_estudiante: {
            resumen: "Prueba completada.",
            fortalezas: [{ descripcion: "La prueba de depuración fue exitosa.", cita: "" }],
            oportunidades: [{ descripcion: "Optimizar el tiempo de respuesta.", cita: "" }],
            siguiente_paso_sugerido: "Reactivar las llamadas a las APIs."
          },
          analisis_profesor: { desempeno_general: "OK", patrones_observados: [], sugerencia_pedagogica: "OK" },
          analisis_habilidades: { "Depuración": { nivel: "Logrado", justificacion_con_cita: "Se devolvió una respuesta falsa correctamente." }},
          analisis_detallado: [],
          bonificacion: 0,
          justificacionDecimas: ""
        }
      ]
    };
    
    // Devolvemos la respuesta falsa inmediatamente.
    return NextResponse.json(fakeEvaluationResult);
    // --- FIN DEL CÓDIGO DE PRUEBA ---

  } catch (error) {
    console.error("Evaluation error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}