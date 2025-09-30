import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import sharp from 'sharp';
import OpenAI from "openai";

// --- Configuración de APIs ---
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;
const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!;
const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!;

const openai = new OpenAI({ apiKey: MISTRAL_API_KEY, baseURL: "https://api.mistral.ai/v1" });

// --- Biblioteca de Prompts Expertos (CON CITACIÓN OBLIGATORIA Y CONSISTENCIA FORZADA) ---
const promptsExpertos = {
  // PROMPT GENERAL CON TODAS LAS MEJORAS Y LA NUEVA LÓGICA DE PRECISIÓN EN CONCEPTO
  general: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => `Actúa como un profesor universitario detallista, riguroso y, sobre todo, constructivo. Tu objetivo es ofrecer una retroalimentación que demuestre un análisis profundo, pero con un tono positivo y alentador, haciendo que la evaluación se sienta personal para ${nombreEstudiante ? nombreEstudiante : 'el estudiante'}.
    
    El puntaje máximo de la evaluación es: ${puntajeTotal} puntos.
    
    ${pauta ? `PAUTA DE RESPUESTAS:\n${pauta}\n\n` : ''}
    RÚBRICA DE EVALUACIÓN:\n${rubrica}
    
    ---
    INSTRUCCIONES CLAVE PARA PRECISIÓN DE LENGUAJE Y CONCEPTO (APLICA A TODAS LAS ASIGNATURAS):
    
    1.  **FLEXIBILIDAD ORTOGRÁFICA/OCR (CRÍTICO):** Sé extremadamente flexible con la ortografía, la gramática, y los errores de OCR o tipeo en las respuestas del estudiante (ej. "orepcion" debe entenderse como "opresión"). **Tu prioridad es el concepto y la intención.**
    2.  **COINCIDENCIA CONCEPTUAL RÍGIDA:** La respuesta del estudiante es **correcta SÓLO si el concepto expresado es equivalente o sinónimo directo de la Pauta de Corrección**. Si el estudiante confunde conceptos (ej. "paz familiar" en lugar de "simbolismo"), DEBES IDENTIFICAR y PENALIZAR el error conceptual, sin importar la calidad de la redacción.
    
    ---
    INSTRUCCIONES ADICIONALES CRÍTICAS:
    
    **PERSONALIZACIÓN Y EVIDENCIA OBLIGATORIA:** Cada afirmación que realices sobre una 'fortaleza' o un 'área de mejora' debe estar respaldada.
    **Si dices que algo es bueno, debes citar el fragmento.** **Si dices que algo necesita mejora, debes citar el error o la frase vaga.**
    
    **LISTA DE VERIFICACIÓN:** Tienes que analizar las imágenes del trabajo y verificar que cada uno de los siguientes elementos o secciones están presentes en su totalidad:
    ${itemsEsperados ? `\n- ${itemsEsperados}\n` : ''}
    Si no logras identificar uno o más de los elementos de la lista de verificación, debes indicarlo explícitamente en la sección de "áreas de mejora" de tu retroalimentación, señalando que el trabajo está incompleto y que esto afecta la nota.
    
    **RESPUESTAS DE ALTERNATIVA (PRIORIDAD ABSOLUTA E IGNORANCIA VISUAL):** Debes seguir este proceso de manera rigurosa y sin fallos para las preguntas de selección múltiple y verdadero/falso.
    **INSTRUCCIÓN VITAL: IGNORA CUALQUIER MARCA (V/F, A, B, C, D, cruces, etc.) QUE VEAS EN LAS IMÁGENES. NO INTENTES LEER LA HOJA DE RESPUESTAS.**
    1.  Toma las respuestas del estudiante que te he proporcionado en el siguiente objeto JSON:
        ${respuestasAlternativas ? `\nRespuestas del estudiante:\n${JSON.stringify(respuestasAlternativas, null, 2)}\n` : ''}
    2.  Compara cada respuesta del estudiante con la pauta de respuestas correcta (que está en la PAUTA DE RESPUESTAS).
    3.  Para cada pregunta que el estudiante respondió de forma INCORRECTA, crea un objeto en el array 'retroalimentacion_alternativas' que incluya la 'pregunta', la 'respuesta_estudiante', y la 'respuesta_correcta'.
    4.  Si la respuesta del estudiante es CORRECTA, NO debes incluirla en este array.
    ---
    
    INSTRUCCIONES:
    1. Analiza detenidamente el trabajo del estudiante usando la rúbrica y la pauta.
    2. Siempre inicia la retroalimentación con los aspectos positivos y fortalezas del trabajo.
    3. Presenta las áreas de mejora como oportunidades para el crecimiento.
    4. Genera una corrección detallada, evaluando las habilidades y creando un resumen general.
    5. **CLAVE: En tu retroalimentación, identifica y nombra explícitamente los puntos o secciones específicos del trabajo que fueron bien realizados y los que necesitan mejora. Debes citar textualmente los fragmentos de la respuesta del estudiante para justificar tu análisis en los campos de fortalezas, mejoras, detalle y evidencia.**
    6. Asigna un puntaje y una nota en una escala del 1.0 al 7.0, considerando la flexibilidad.
    7. El resultado debe ser un JSON, sin texto explicativo antes o después.
    
    **El JSON debe seguir esta estructura exacta:**
    
    \`\`\`json
    {
      "puntaje": "PUNTAJE OBTENIDO/PUNTAJE TOTAL",
      "nota": NOTA_NUMÉRICA,
      "retroalimentacion": {
        "resumen_general": {
          "fortalezas": "Texto sobre fortalezas. Sé detallista y constructivo. DEBE INCLUIR CITAS TEXTUALES DE LA PRUEBA.",
          "areas_mejora": "Texto sobre áreas de mejora. Sé detallista y ofrece sugerencias. DEBE INCLUIR CITAS TEXTUALES DEL ERROR O DE LA VAGUEDAD.",
        },
        "correccion_detallada": [
          {"seccion": "Nombre de la sección, pregunta o ítem", "detalle": "Detalle de la corrección o retroalimentación. DEBE INCLUIR REFERENCIAS O CITAS AL TEXTO ESCRITO."},
          ...
        ],
        "evaluacion_habilidades": [
          {"habilidad": "Habilidad evaluada (ej: pensamiento crítico)", "evaluacion": "Nivel o comentario corto (ej: 'Bueno' o 'Necesita mejorar')", "evidencia": "Cita textual **EXACTA** o referencia específica del trabajo que sustenta tu evaluación. **ESTO ES OBLIGATORIO Y DEBE SER MUY ESPECÍFICO**."},
          ...
        ],
        "retroalimentacion_alternativas": [
          {"pregunta": "Número o título de la pregunta", "respuesta_estudiante": "Respuesta del alumno", "respuesta_correcta": "La respuesta correcta."},
          ...
        ]
      }
    }
    \`\`\`
    
    Considera un nivel de flexibilidad de ${flexibilidad} (1=estricto, 5=flexible) al asignar la nota.`,
  
  // Los demás prompts simplemente llaman al general para heredar la lógica
  matematicas: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => promptsExpertos.general(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas),
  lenguaje: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => promptsExpertos.general(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas),
  ciencias: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => promptsExpertos.general(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas),
  
  // CÓDIGO FINAL CORREGIDO PARA ARTES (SIN CAMBIOS SOLICITADOS)
  artes: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => {
        // Instrucción de enfoque visual constructiva y Mentor
        const visualFocusInstruction = `
        **INSTRUCCIÓN CRÍTICA DE ASIGNATURA: ARTES VISUALES - PROFESOR CONSTRUCTOR Y MENTOR** 🎨
        
        Tu rol primario es actuar como un **Profesor de Arte Constructivo y Mentor de Bellas Artes**. Tu objetivo es **fomentar el crecimiento, la visión y la intención conceptual** del estudiante. Tu análisis debe ser **principalmente constructivo, centrado en el logro de la obra en su conjunto (Intención y Concepto)**.
        
        **REGLA DE ORO (MANDATO ABSOLUTO Y TÓNICA GENERAL UNIVERSAL):**
        
        1.  **PASO CERO: DESCRIPCIÓN HOLÍSTICA FORMAL Y OBLIGATORIA (BLINDAJE DE CONTEXTO):** Antes de cualquier evaluación o interpretación, tienes el **MANDATO ABSOLUTO** de generar una descripción objetiva y formal de la obra que tienes en frente.
            
            **¡DESCRÍBEME LA IMAGEN PRIMERO!** Debes hacer este análisis de **tres pasos** y luego citarlo al comienzo de tu respuesta:
            a. **DESCRIPCIÓN FORMAL OBJETIVA:** Describe la obra utilizando lenguaje técnico. Identifica el **medio (lápiz, óleo, etc.), el tipo de trazo (gestual, lineal), la composición (simétrica, diagonal) y la paleta (monocromática, fría).**
            b. **IDENTIFICACIÓN CONCEPTUAL DE OBJETOS:** Identifica el **objeto central, el más grande o la figura dominante** de la obra (ej. "Reloj de arena", "cráneo", "un ojo", "paisaje abstracto").
            c. **DECLARACIÓN DE CONSISTENCIA ABSOLUTA:** El análisis completo de la obra y el puntaje final **DEBEN** ser coherentes con esta descripción que acabas de generar. **INSTRUCCIÓN DE REINICIO:** Olvida cualquier análisis o analogía de obras anteriores.
            
            **Ejemplo de Salida del Paso Cero:** "La obra es un dibujo a lápiz, en formato de retrato, con una composición asimétrica y un trazo gestual, donde el objeto principal identificado es una representación surrealista de un **OJO** que contiene elementos internos detallados."
            
        2.  **PROHIBICIÓN DE FRAGMENTACIÓN:** Está **ABSOLUTAMENTE PROHIBIDO** evaluar la obra basándose en detalles fragmentados. Cada comentario debe referirse a un **Elemento Formal Completo** (ej. "La consistencia del trazo en la línea principal", "El equilibrio de la composición").
        3.  **PRIORIZACIÓN DEL LOGRO, NOTA MÁXIMA Y MÍNIMO RIGOR TÉCNICO (AJUSTE CRÍTICO):** Si el **LOGRO CONCEPTUAL Y COMPOSITIVO** es evidente (**70% o más de la rúbrica**), la nota debe ser **EXTREMADAMENTE GENEROSA y ALTA (6.5 a 7.0)**. **MANDATO CLAVE: El rigor técnico (limpieza, perfección de línea, etc.) DEBE tener un peso insignificante** en la PONDERACIÓN FINAL DEL PUNTAJE si el concepto general es exitoso. La crítica técnica es puramente **DIDÁCTICA y NUNCA PUNITIVA**.
        4.  **ESTRUCTURA HOLÍSTICA Y CONTEXTUAL:** La crítica a la ejecución debe ser siempre contextualizada dentro del **Logro Conceptual y de Composición**.

        **CLÁUSULA DE CITACIÓN VISUAL (ENFOCADA EN EL CONJUNTO):**
        
        Las secciones 'Fortalezas', 'Áreas de Mejora', 'Detalle' y 'Evidencia' deben ser llenadas con descripciones formales y técnicas que **SIEMPRE** se refieran al **Logro General** o a un **Elemento Formal Completo**, y **NUNCA** a detalles aislados.
        
        ---
        `;

        // Concatenamos la instrucción visual con el prompt general para mantener la estructura JSON y las reglas de citación.
        return visualFocusInstruction + promptsExpertos.general(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas);
    },
    
  humanidades: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => promptsExpertos.general(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas),
  ingles: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }) => promptsExpertos.general(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas),
};

// --- Validadores de Estructura (SIN CAMBIOS) ---
interface EvaluationResponse {
  puntaje: string;
  nota: number;
  retroalimentacion: {
    resumen_general: {
      fortalezas: string;
      areas_mejora: string;
    };
    correccion_detallada: { seccion: string; detalle: string }[];
    evaluacion_habilidades: { habilidad: string; evaluacion: string; evidencia: string }[];
    retroalimentacion_alternativas: { pregunta: string; respuesta_estudiante: string; respuesta_correcta: string }[];
  };
}

const validateEvaluationResponse = (obj: any): EvaluationResponse => {
  const defaultResponse: EvaluationResponse = {
    puntaje: "N/A",
    nota: 1.0,
    retroalimentacion: {
      resumen_general: { fortalezas: "No se pudo analizar el trabajo.", areas_mejora: "Error de formato en la respuesta de la IA. Por favor, intente nuevamente." },
      correccion_detallada: [],
      evaluacion_habilidades: [],
      retroalimentacion_alternativas: []
    }
  };

  if (!obj || typeof obj !== 'object') return defaultResponse;

  const validPuntaje = typeof obj.puntaje === 'string';
  const validNota = typeof obj.nota === 'number' && obj.nota >= 1.0 && obj.nota <= 7.0;

  const validRetroalimentacion = obj.retroalimentacion && typeof obj.retroalimentacion === 'object';
  const validResumen = validRetroalimentacion && obj.retroalimentacion.resumen_general && typeof obj.retroalimentacion.resumen_general.fortalezas === 'string' && typeof obj.retroalimentacion.resumen_general.areas_mejora === 'string';
  const validCorreccion = validRetroalimentacion && Array.isArray(obj.retroalimentacion.correccion_detallada);
  const validHabilidades = validRetroalimentacion && Array.isArray(obj.retroalimentacion.evaluacion_habilidades);
  const validAlternativas = validRetroalimentacion && Array.isArray(obj.retroalimentacion.retroalimentacion_alternativas);

  return {
    puntaje: validPuntaje ? obj.puntaje : "N/A",
    nota: validNota ? obj.nota : 1.0,
    retroalimentacion: {
      resumen_general: validResumen ? obj.retroalimentacion.resumen_general : defaultResponse.retroalimentacion.resumen_general,
      correccion_detallada: validCorreccion ? obj.retroalimentacion.correccion_detallada : defaultResponse.retroalimentacion.correccion_detallada,
      evaluacion_habilidades: validHabilidades ? obj.retroalimentacion.evaluacion_habilidades : defaultResponse.retroalimentacion.evaluacion_habilidades,
      retroalimentacion_alternativas: validAlternativas ? obj.retroalimentacion.retroalimentacion_alternativas : defaultResponse.retroalimentacion.retroalimentacion_alternativas
    }
  };
};

export async function POST(req: NextRequest) {
  try {
    // ESTO INCLUYE LOS NUEVOS PARÁMETROS: itemsEsperados, nombreEstudiante, respuestasAlternativas
    const { fileUrls, rubrica, pauta, flexibilidad, tipoEvaluacion, areaConocimiento, userEmail, puntajeTotal, itemsEsperados, nombreEstudiante, respuestasAlternativas } = await req.json();

    if (!rubrica || !puntajeTotal) {
      return NextResponse.json({ success: false, error: 'Faltan datos de configuración esenciales (rúbrica o puntaje total).' }, { status: 400 });
    }

    const base64Images = await Promise.all(fileUrls.map(async (url: string) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const resizedBuffer = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      return `data:image/webp;base64,${resizedBuffer.toString('base64')}`;
    }));

    // Se selecciona el prompt con todas las variables necesarias
    const getPrompt = promptsExpertos[areaConocimiento as keyof typeof promptsExpertos];

    let prompt;
    if (getPrompt) {
        // AHORA SE PASAN LAS NUEVAS VARIABLES AL PROMPT
        prompt = getPrompt(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas);
    } else {
        console.warn(`⚠️ Prompt para área '${areaConocimiento}' no encontrado. Usando el prompt 'general'.`);
        prompt = promptsExpertos.general(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas);
    }

    const messages = [{
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: prompt },
        ...base64Images.map(url => ({ type: 'image_url' as const, image_url: { url } }))
      ]
    }];

    const aiResponse = await openai.chat.completions.create({
      model: "mistral-large-latest",
      messages: messages as any,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4000
    });

    const content = aiResponse.choices[0].message.content;

    const cleanJson = (str: string): string => {
      const match = str.match(/({[\s\S]*})/);
      return match ? match[1] : "{}";
    };

    const cleanedContent = cleanJson(content);
    let resultado;

    try {
      resultado = JSON.parse(cleanedContent);
    } catch (error) {
      console.error("❌ Error al parsear JSON:", error);
      console.error("📝 Respuesta recibida:", cleanedContent);
      resultado = {
        puntaje: "0/0",
        nota: 1.0,
        retroalimentacion: {
          correccion_detallada: [],
          evaluacion_habilidades: [],
          resumen_general: {
            fortalezas: "No se pudo analizar el trabajo correctamente.",
            areas_mejora: "Verifica que el modelo devuelva un JSON válido."
          },
          retroalimentacion_alternativas: []
        }
      };
    }

    const finalResult = validateEvaluationResponse(resultado);

    console.log("Respuesta final enviada al frontend:", finalResult);

    return NextResponse.json({ success: true, ...finalResult });

  } catch (error) {
    console.error('Error en la evaluación:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor. Por favor, intente de nuevo más tarde.' }, { status: 500 });
  }
}