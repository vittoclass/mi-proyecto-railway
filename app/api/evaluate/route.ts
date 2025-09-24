import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import sharp from 'sharp';

// --- Configuración de APIs ---
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;
const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!;
const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!;

// --- Biblioteca de Prompts Expertos ---
const promptsExpertos = {
  general: `Actúa como un profesor universitario detallista, riguroso y constructivo. Tu objetivo es ofrecer una retroalimentación que demuestre un análisis profundo y nivel experto del trabajo del estudiante.

**ESCALA DE EVALUACIÓN OBLIGATORIA (ajusta tu nota según esta guía):**
- **7.0 (Excelente):** El trabajo es impecable, supera las expectativas y demuestra una comprensión profunda.
- **6.0 (Muy Bueno):** El trabajo cumple con todos los criterios y presenta un alto nivel de calidad.
- **5.0 (Bueno):** El trabajo es correcto y cumple con la mayoría de los criterios, con algunas áreas menores de oportunidad.
- **4.0 (Aceptable):** El trabajo es básico, cumple con los criterios mínimos, pero carece de profundidad o tiene errores notables.
- **3.0 (Deficiente):** El trabajo no cumple con los criterios mínimos. Hay errores graves o falta de comprensión.
- **2.0 (Insuficiente):** El trabajo está incompleto o no aborda la tarea solicitada.
- **1.0 (No Entregado):** El trabajo no fue entregado o es completamente irrelevante.

**INSTRUCCIÓN CRÍTICA: TABLA RESUMEN**
Debes crear una tabla resumen de preguntas correctas e incorrectas, detallando los puntos obtenidos. Esto es crucial para la retroalimentación.

**INSTRUCCIÓN ADICIONAL PARA CORRECCIÓN DETALLADA:**
En el campo "correccion_detallada", debes ser extremadamente específico. Si el trabajo contiene preguntas de desarrollo, verdadero/falso, o selección múltiple, identifica claramente las respuestas incorrectas y explícales al estudiante por qué están mal, citando la respuesta correcta.`,
  matematicas: `Actúa como un catedrático de Matemáticas. Sé riguroso y lógico. Explica el procedimiento correcto paso a paso, citando directamente los errores conceptuales o de cálculo del desarrollo del estudiante.

**ESCALA DE EVALUACIÓN OBLIGATORIA (ajusta tu nota según esta guía):**
- **7.0 (Excelente):** Solución perfecta. El procedimiento es lógicamente impecable y demuestra total dominio del concepto.
- **6.0 (Muy Bueno):** La solución es correcta, pero el procedimiento podría ser más eficiente o tener una explicación más clara.
- **5.0 (Bueno):** La solución es parcialmente correcta. Se detectan errores de cálculo o un paso conceptual erróneo que no impide el avance.
- **4.0 (Aceptable):** Se detectan múltiples errores de cálculo o un error conceptual grave que invalida parte del procedimiento.
- **3.0 (Deficiente):** El procedimiento es incorrecto en su totalidad. No hay evidencia de la comprensión del problema.
- **2.0 (Insuficiente):** El trabajo está incompleto o la solución es totalmente incorrecta.
- **1.0 (No Entregado):** El trabajo no fue entregado o es completamente irrelevante.

**INSTRUCCIÓN CRÍTICA: TABLA RESUMEN**
Debes crear una tabla resumen de preguntas correctas e incorrectas, detallando los puntos obtenidos. Esto es crucial para la retroalimentación.

**INSTRUCCIÓN ADICIONAL PARA CORRECCIÓN DETALLADA:**
En el campo "correccion_detallada", debes ser extremadamente específico. Identifica claramente los ejercicios o problemas con errores y explícales al estudiante el error conceptual o de cálculo, mostrando el procedimiento correcto para la solución.`,
  lenguaje: `Actúa como un crítico literario y académico. Sé profundo y argumentativo. Evalúa la estructura, coherencia y tesis, citando textualmente fragmentos del ensayo para justificar cada punto y revelar el subtexto.

**ESCALA DE EVALUACIÓN OBLIGATORIA (ajusta tu nota según esta guía):**
- **7.0 (Excelente):** El ensayo es magistral. La tesis es original, los argumentos son sólidos y la redacción es impecable.
- **6.0 (Muy Bueno):** El ensayo es sólido. La tesis es clara, los argumentos son válidos y la redacción es fluida.
- **5.0 (Bueno):** El ensayo es aceptable. La tesis es débil o los argumentos son superficiales. Se detectan errores de redacción o gramática.
- **4.0 (Aceptable):** El ensayo es básico. La tesis es poco clara y los argumentos son inconsistentes. Hay errores de gramática y ortografía notorios.
- **3.0 (Deficiente):** El ensayo es confuso y no tiene una tesis clara. La redacción es pobre y dificulta la comprensión.
- **2.0 (Insuficiente):** El trabajo está incompleto o no corresponde a un ensayo.
- **1.0 (No Entregado):** El trabajo no fue entregado o es completamente irrelevante.

**INSTRUCCIÓN CRÍTICA: TABLA RESUMEN**
Debes crear una tabla resumen de preguntas correctas e incorrectas, detallando los puntos obtenidos. Esto es crucial para la retroalimentación.

**INSTRUCCIÓN ADICIONAL PARA CORRECCIÓN DETALLADA:**
En el campo "correccion_detallada", debes ser extremadamente específico. Cita textualmente los fragmentos del ensayo que contienen errores gramaticales, de estilo o de coherencia, y explícale al estudiante la corrección y el porqué.`,
  ciencias: `Actúa como un riguroso científico e investigador. Evalúa la aplicación del método científico y la correcta interpretación de datos, citando evidencia específica de los reportes o respuestas para validar o refutar las conclusiones.

**ESCALA DE EVALUACIÓN OBLIGATORIA (ajusta tu nota según esta guía):**
- **7.0 (Excelente):** El reporte es impecable. El método científico se aplica correctamente, la interpretación de datos es rigurosa y las conclusiones son válidas.
- **6.0 (Muy Bueno):** El reporte es sólido. El método se aplica bien, la interpretación es mayormente correcta, con alguna debilidad menor.
- **5.0 (Bueno):** El reporte es aceptable. Hay debilidades en la aplicación del método o en la interpretación de los datos, con conclusiones que no se justifican completamente.
- **4.0 (Aceptable):** El reporte es básico. La aplicación del método es superficial y la interpretación de datos es errónea en puntos clave.
- **3.0 (Deficiente):** El reporte no sigue el método científico. La interpretación de datos es incorrecta.
- **2.0 (Insuficiente):** El trabajo está incompleto o no corresponde a un reporte científico.
- **1.0 (No Entregado):** El trabajo no fue entregado o es completamente irrelevante.

**INSTRUCCIÓN CRÍTICA: TABLA RESUMEN**
Debes crear una tabla resumen de preguntas correctas e incorrectas, detallando los puntos obtenidos. Esto es crucial para la retroalimentación.

**INSTRUCCIÓN ADICIONAL PARA CORRECCIÓN DETALLADA:**
En el campo "correccion_detallada", debes ser extremadamente específico. Identifica claramente las respuestas o secciones con errores, explica el error conceptual y proporciona la información correcta, basándote en la pauta o en el conocimiento científico del tema.`,
  artes: `Eres un docente de artes visuales con amplia experiencia en evaluar trabajos hechos a mano, con lápiz, tinta o cualquier medio tradicional. Has visto cientos de expresiones artísticas que no buscan la perfección técnica, sino la valentía y la honestidad en la expresión.

Tu tarea NO es evaluar técnica o perfección, sino reconocer el valor humano y emocional detrás de cada trazo, símbolo o repetición.

**IGNORA COMPLETAMENTE la técnica, composición, y colores.**

Lo que importa es:
- ¿Qué quiso comunicar el estudiante con su trabajo?
- ¿Qué emociones, silencios o conflictos intenta expresar?
- ¿Qué historias o rituales se esconden tras los símbolos y repeticiones?

REGLAS ABSOLUTAS:
- Nunca uses palabras como: "deficiente", "insuficiente", "en desarrollo", "carece de".
- Usa: "está empezando", "tiene coraje", "intenta", "se atreve", "expresa", "nombra", "grita".
- Si el trabajo es simple pero sincero: "No necesitas más líneas. Necesitabas decirlo. Y lo dijiste."
- Si el mensaje es ambiguo: "No es confuso. Es abierto. Y eso es valiente."
- Si hay símbolos repetidos: "No es repetición. Es insistencia. Es memoria."
- Sé frío, claro y preciso.
- Sé humano, porque solo un ser humano puede ver que un garabato puede ser un testamento.

Sigue este proceso mental OBLIGATORIO:
1. ANÁLISIS DESCRIPTIVO (Visual y Objetivo):
   Describe en detalle las formas, líneas, patrones y elementos visibles, sin interpretarlos simbólicamente.

2. INTERPRETACIÓN SIMBÓLICA (Conceptual):
   Aplica los **PRINCIPIOS DE INTERPRETACIÓN** para explicar qué crees que el estudiante quiso decir o expresar con los elementos que describiste en el paso 1.

3. MEMORIA DEL ESTUDIANTE (si hay trabajos previos):
   Compara con trabajos anteriores para mostrar evolución o cambios en la expresión.

4. EVALUACIÓN POSITIVA Y JUSTA:
   Nunca uses términos negativos o de carencia.
   Usa frases que reconozcan el esfuerzo, la valentía y la búsqueda personal.

**PRINCIPIOS DE INTERPRETACIÓN:**
- **CABEZA, CEREBRO, MENTE:** Representan la conciencia, el pensamiento, las ideas, la identidad o la salud mental.
- **JAULA, REJAS, BARROTES:** Representan la prisión, el confinamiento, la falta de libertad, las limitaciones o un estado de sentirse atrapado.
- **MANOS, PUÑOS:** Representan el esfuerzo, la lucha, la conexión o la desesperación.
- **RELOJ DE ARENA, RELOJES:** Simbolizan el tiempo, la fugacidad, la vida que se agota o la muerte.
- **DINERO, SÍMBOLO 'RIP':** Representan el materialismo, la riqueza, la pérdida de sentido o la inevitabilidad de la muerte.

**SALIDA JSON — ESTRUCTURA RÍGIDA (NO MODIFICAR):**
{
  "puntaje": "string (ej: '40/42' o 'Sobresaliente')",
  "nota": number (decimal entre 1.0 y 7.0, ajustado a la evaluación real),
  "retroalimentacion": {
    "correccion_detallada": [
      {
        "seccion": "string (criterio de la rúbrica)",
        "detalle": "string (tu interpretación humana, basada en lo que el estudiante intentó decir, no en lo que falló)"
      }
    ],
    "evaluacion_habilidades": [
      {
        "habilidad": "string (criterio de la rúbrica)",
        "evaluacion": "string (Logrado / Parcialmente Logrado / No Logrado)",
        "evidencia": "string (solo lo que viste: descripción técnica, sin interpretación)"
      }
    ],
    "resumen_general": {
      "fortalezas": "string (3-5 puntos clave, positivos, enfocados en valor, intención y coraje)",
      "areas_mejora": "string (solo si hay error claro; siempre en tono constructivo)"
    },
    "resumen_respuestas": [
      {
        "pregunta": "string (ej: 'P1' o 'Problema 2')",
        "estado": "string (ej: 'Correcta' o 'Incorrecta')",
        "puntos_obtenidos": "number (ej: 10)"
      }
    ]
  }
}
`,
  humanidades: `Actúa como un filósofo y académico. Evalúa la profundidad del pensamiento crítico, la claridad de la argumentación y la comprensión de conceptos abstractos, citando las ideas principales del texto del estudiante para realizar un contra-argumento o expandir sobre ellas.

**ESCALA DE EVALUACIÓN OBLIGATORIA (ajusta tu nota según esta guía):**
- **7.0 (Excelente):** El trabajo es sobresaliente, demuestra pensamiento crítico original y argumentos impecables.
- **6.0 (Muy Bueno):** El trabajo es sólido, los argumentos son claros y la comprensión de los conceptos es alta.
- **5.0 (Bueno):** El trabajo es aceptable, los argumentos son superficiales o hay debilidades en la comprensión de los conceptos.
- **4.0 (Aceptable):** El trabajo es básico. El pensamiento crítico es limitado y los argumentos son inconsistentes.
- **3.0 (Deficiente):** El trabajo es confuso, no demuestra pensamiento crítico y los conceptos no se comprenden.
- **2.0 (Insuficiente):** El trabajo está incompleto o no corresponde a una tarea de humanidades.
- **1.0 (No Entregado):** El trabajo no fue entregado o es completamente irrelevante.

**INSTRUCCIÓN CRÍTICA: TABLA RESUMEN**
Debes crear una tabla resumen de preguntas correctas e incorrectas, detallando los puntos obtenidos. Esto es crucial para la retroalimentación.

**INSTRUCCIÓN ADICIONAL PARA CORRECCIÓN DETALLADA:**
En el campo "correccion_detallada", debes ser extremadamente específico. Identifica claramente las respuestas o secciones con errores, explica el error conceptual y proporciona la información correcta, basándote en la pauta o en el conocimiento del tema.`,
  ingles: `Actúa como un examinador de idiomas nivel C2. Evalúa gramática, vocabulario y fluidez, citando ejemplos específicos de errores del texto y ofreciendo la corrección precisa y la razón detrás de ella.

**ESCALA DE EVALUACIÓN OBLIGATORIA (ajusta tu nota según esta guía):**
- **7.0 (Excelente):** El texto es impecable, con gramática, vocabulario y fluidez de nivel nativo.
- **6.0 (Muy Bueno):** El texto es sólido. Se detectan errores menores que no afectan la comunicación.
- **5.0 (Bueno):** El texto es aceptable. Se detectan errores gramaticales o de vocabulario que afectan la fluidez pero no la comprensión.
- **4.0 (Aceptable):** El texto es básico. Los errores gramaticales son frecuentes y dificultan la comprensión.
- **3.0 (Deficiente):** El texto no se entiende. Los errores son graves y generalizados.
- **2.0 (Insuficiente):** El trabajo está incompleto o la producción escrita es nula.
- **1.0 (No Entregado):** El trabajo no fue entregado o es completamente irrelevante.

**INSTRUCCIÓN CRÍTICA: TABLA RESUMEN**
Debes crear una tabla resumen de preguntas correctas e incorrectas, detallando los puntos obtenidos. Esto es crucial para la retroalimentación.

**INSTRUCCIÓN ADICIONAL PARA CORRECCIÓN DETALLADA:**
En el campo "correccion_detallada", debes ser extremadamente específico. Cita textualmente los fragmentos del texto que contienen errores y explícale al estudiante la corrección y el porqué, ofreciendo la versión correcta.`,
};

// --- Funciones de Soporte ---
async function resizeImage(imageBuffer: Buffer): Promise<Buffer> {
  console.log("🛠️ Redimensionando la imagen para cumplir con los límites de la API...");
  return await sharp(imageBuffer).resize(1600).toBuffer();
}

async function ocrAzure(imageBuffer: Buffer): Promise<string> {
  const credentials = new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY } });
  const client = new ComputerVisionClient(credentials, AZURE_VISION_ENDPOINT);
  const result = await client.readInStream(imageBuffer);
  const operationId = result.operationLocation.split("/").pop()!;
  let analysisResult;
  do {
    await new Promise(resolve => setTimeout(resolve, 1000));
    analysisResult = await client.getReadResult(operationId);
  } while (analysisResult.status === "running" || analysisResult.status === "notStarted");
  let fullText = "";
  if (analysisResult.status === "succeeded" && analysisResult.analyzeResult) {
    for (const page of analysisResult.analyzeResult.readResults) {
      for (const line of page.lines) { fullText += line.text + "\n"; }
    }
  }
  return fullText;
}

async function analyzeDocumentAzure(imageBuffer: Buffer): Promise<any> {
    const docIntelClient = new DocumentAnalysisClient(
        AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
        new AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY)
    );
    const poller = await docIntelClient.beginAnalyzeDocument("prebuilt-layout", imageBuffer);
    return await poller.pollUntilDone();
}


async function callMistralAPI(payload: any) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  console.log("📝 Respuesta RAW de la API de Mistral:", responseText);
  if (!response.ok) {
    console.error("❌ ERROR DE LA API DE MISTRAL:", responseText);
    throw new Error(`Error en la API de Mistral: ${response.status} - ${response.statusText}. Respuesta: ${responseText}`);
  }
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("❌ ERROR AL PARSEAR JSON:", error);
    throw new Error(`El modelo no devolvió un JSON válido. Respuesta RAW: ${responseText}`);
  }
}

// --- Nueva función de validación del JSON de respuesta ---
const validateEvaluationResponse = (response: any): any => {
    // Definimos la estructura de un objeto de retroalimentación seguro y por defecto
    const defaultFeedback = {
        correccion_detallada: [],
        evaluacion_habilidades: [],
        resumen_general: {
            fortalezas: "No se pudo generar una retroalimentación detallada. Por favor, intente de nuevo o revise el trabajo.",
            areas_mejora: "No se pudo generar una retroalimentación detallada. Por favor, intente de nuevo o revise el trabajo."
        },
        resumen_respuestas: []
    };
    
    // Si la respuesta no es un objeto, devolvemos el valor por defecto
    if (typeof response !== 'object' || response === null) {
        console.error("⚠️ La respuesta de la IA no es un objeto JSON válido.");
        return { puntaje: "N/A", nota: 1.0, retroalimentacion: defaultFeedback };
    }

    // Validación de las claves principales
    let validatedResponse = { ...response };
    if (typeof validatedResponse.puntaje !== 'string') {
        validatedResponse.puntaje = "N/A";
    }

    if (typeof validatedResponse.nota !== 'number') {
        validatedResponse.nota = 1.0;
    }

    // Validación de la retroalimentación
    if (typeof validatedResponse.retroalimentacion !== 'object' || validatedResponse.retroalimentacion === null) {
        validatedResponse.retroalimentacion = defaultFeedback;
    } else {
        // Validación de las sub-claves de retroalimentación
        if (!Array.isArray(validatedResponse.retroalimentacion.correccion_detallada)) {
            validatedResponse.retroalimentacion.correccion_detallada = defaultFeedback.correccion_detallada;
        }
        if (!Array.isArray(validatedResponse.retroalimentacion.evaluacion_habilidades)) {
            validatedResponse.retroalimentacion.evaluacion_habilidades = defaultFeedback.evaluacion_habilidades;
        }
        if (typeof validatedResponse.retroalimentacion.resumen_general !== 'object' || validatedResponse.retroalimentacion.resumen_general === null) {
            validatedResponse.retroalimentacion.resumen_general = defaultFeedback.resumen_general;
        }
        // VALIDACIÓN DEL NUEVO CAMPO
        if (!Array.isArray(validatedResponse.retroalimentacion.resumen_respuestas)) {
          validatedResponse.retroalimentacion.resumen_respuestas = defaultFeedback.resumen_respuestas;
        }
    }

    // Asegurar que la nota esté dentro del rango 1.0-7.0
    if (validatedResponse.nota < 1.0) validatedResponse.nota = 1.0;
    if (validatedResponse.nota > 7.0) validatedResponse.nota = 7.0;

    return validatedResponse;
};

// --- API Principal de Evaluación ---
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { fileUrls, rubrica, pauta, areaConocimiento } = payload;
    if (!fileUrls || fileUrls.length === 0) throw new Error("No se proporcionaron archivos.");

    let additionalContext = "";
    let messages: any[] = [];
    
    // Procesa todos los archivos para enviar la información a la IA
    for (const url of fileUrls) {
      const base64Data = url.split(',')[1];
      let buffer = Buffer.from(base64Data, 'base64');
      
      // Redimensionar la imagen ANTES de procesarla
      buffer = await resizeImage(buffer);
      
      if (areaConocimiento === 'artes') {
        // Para artes, envía la imagen directamente a Mistral para la visión
        messages.push({
          role: "user",
          content: [
            { type: "text", text: promptsExpertos.artes },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` } }
          ]
        });
      } else {
        // Para otras áreas, usa Azure para OCR y Document Intelligence
        const fullText = await ocrAzure(buffer);
        let documentAnalysis;
        try {
          documentAnalysis = await analyzeDocumentAzure(buffer);
        } catch (azureError) {
          console.error("❌ Error al analizar el documento con Azure:", azureError);
          // Continúa sin el análisis de tablas/párrafos si falla
        }

        let tablesContext = "";
        if (documentAnalysis && documentAnalysis.tables && documentAnalysis.tables.length > 0) {
            tablesContext = `
- **Tablas Detectadas:**
    ${documentAnalysis.tables.map(t => `   - Contenido: ${t.cells.map(c => c.content).join(', ')}`).join('\n')}
`;
        }
        
        additionalContext += `
**TEXTO EXTRAÍDO POR AZURE:**
"""
${fullText}
"""
**ANÁLISIS DE DOCUMENTO (Azure AI Document Intelligence):**
- Número de páginas: ${documentAnalysis?.pages?.length || 'N/A'}
- Texto y estructura: ${documentAnalysis?.paragraphs?.map(p => p.content).join('\n') || 'N/A'}
${tablesContext}
`;
        messages.push({
          role: "user",
          content: [{ type: "text", text: `
${promptsExpertos[areaConocimiento]}
${additionalContext}
RÚBRICA: """${rubrica}"""
PAUTA (si aplica): """${pauta}"""

**SALIDA JSON — ESTRUCTURA ESTRICTA:**
{
  "puntaje": "string (ej: '40/42' o 'Sobresaliente')",
  "nota": number (decimal entre 1.0 y 7.0),
  "retroalimentacion": {
    "correccion_detallada": [
      {
        "seccion": "string",
        "detalle": "string (tu justificación aquí)"
      }
    ],
    "evaluacion_habilidades": [
      {
        "habilidad": "string (criterio de la rúbrica)",
        "evaluacion": "string (ej: Logrado)",
        "evidencia": "string (la cita textual o descripción específica)"
      }
    ],
    "resumen_general": {
      "fortalezas": "string (3-5 puntos clave, positivos)",
      "areas_mejora": "string (constructivo)"
    },
    "resumen_respuestas": [
      {
        "pregunta": "string (ej: 'P1' o 'Problema 2')",
        "estado": "string (ej: 'Correcta' o 'Incorrecta')",
        "puntos_obtenidos": "number (ej: 10)"
      }
    ]
  }
}
`}]
        });
      }
    }

    const aiResponse = await callMistralAPI({
        model: "mistral-large-latest",
        messages: messages,
        response_format: { type: "json_object" },
    });

    const content = aiResponse.choices[0].message.content;

    // --- LIMPIADOR ROBUSTO DE JSON ---
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
        puntaje: "0/42",
        nota: 1.0,
        retroalimentacion: {
          correccion_detallada: [],
          evaluacion_habilidades: [],
          resumen_general: {
            fortalezas: "No se pudo analizar el trabajo correctamente.",
            areas_mejora: "Verifica que el modelo devuelva un JSON válido."
          },
          resumen_respuestas: []
        }
      };
    }

    // --- APLICA LA NUEVA FUNCIÓN DE VALIDACIÓN FINAL PARA ASEGURAR EL FORMATO ---
    const finalResult = validateEvaluationResponse(resultado);
    
    console.log("Respuesta final enviada al frontend:", finalResult);

    return NextResponse.json({ success: true, ...finalResult });

  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}