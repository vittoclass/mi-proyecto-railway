import { type NextRequest, NextResponse } from "next/server";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import sharp from 'sharp';
import OpenAI from "openai";

// --- Configuración de APIs (Configuración estable Mistral/Azure DI) ---
const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!;
const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!;

// VOLVEMOS A LA CLAVE Y URL BASE DE MISTRAL
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!; 

const openai = new OpenAI({ apiKey: MISTRAL_API_KEY, baseURL: "https://api.mistral.ai/v1" });
// Se mantiene el cliente de Azure DI para extracción de texto
const docIntelClient = new DocumentAnalysisClient(AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT, new AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY));


// --- PROMPT BASE (Incluye Baremo y Rigor) ---
const generalPromptBase = (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }, areaConocimiento?: string) => {
    
    const scoreTotal = Number(puntajeTotal) > 0 ? Number(puntajeTotal) : 51; 
    
    // 🚨 AJUSTE DE EXIGENCIA: 40% para ARTES, 50% para el resto (solución a la severidad)
    const exigenciaPorcentaje = areaConocimiento === 'artes' ? 0.40 : 0.50;
    const puntosAprobacion = Math.ceil(scoreTotal * exigenciaPorcentaje); 
    
    const totalAlternativas = pautaCorrectaAlternativas ? Object.keys(pautaCorrectaAlternativas).length : 'N/A';

    return `Actúa como un profesor universitario **EXTREMADAMENTE RIGUROSO** cuyo principal objetivo es la **VERIFICACIÓN PROCEDIMENTAL Y LITERAL**. Tu evaluación debe ser 100% precisa en los datos y el formato, simulando un juicio experto.
    
    El puntaje máximo de la evaluación es: ${scoreTotal} puntos.
    
    ${pauta ? `PAUTA DE RESPUESTAS (Preguntas de Desarrollo/Abiertas):\n${pauta}\n\n` : ''}
    RÚBRICA DE EVALUACIÓN (CRITERIO PARA DESARROLLO - APLICAR ESCALA 0-10 ESTRICTAMENTE):\n${rubrica}
    
    ---
    REGLAS DE ORO PROCEDIMENTALES (OBLIGATORIO Y NO NEGOCIABLE):
    1.  EVALUACIÓN DE ALTERNATIVAS (S.M. y V/F): **LA PAUTA CORRECTA (en el objeto 'pauta_correcta_alternativas') ES LA ÚNICA FUENTE DE VERDAD.** Debes corregir los ${totalAlternativas} ítems de alternativa. Genera el array 'retroalimentacion_alternativas' que contenga **CADA PREGUNTA** con su resultado (Correcta/Incorrecta). **Asume que cada ítem vale 1 punto para S.M. y 2 puntos para V/F (si hay) para la corrección, a menos que se indique lo contrario en la pauta o el puntaje total.**
    2.  PUNTAJE DE DESARROLLO Y CITACIÓN OBLIGATORIA: Para generar el puntaje de las Preguntas de Desarrollo, aplica la escala de 0-10 puntos de la Rúbrica. **SIEMPRE Y CUANDO EL CONCEPTO PRINCIPAL ESTÉ PRESENTE, ASIGNA UN PUNTAJE DE DESARROLLO CON GENEROSIDAD (7/10 O MÁS) IGNORANDO ERRORES DE REDACCIÓN Y ORTOGRAFÍA.** Este factor de generosidad es para elevar la base de puntaje. **DESGLÓSALO OBLIGATORIAMENTE EN EL CAMPO 'detalle_puntaje_desarrollo', Y DEBE INCLUIR LA CITA TEXTUAL COMPLETA DE LA RESPUESTA DEL ESTUDIANTE PARA CADA PREGUNTA DE DESARROLLO, USANDO EL FORMATO DE OBJETO ESPECIFICADO ABAJO.**
    3.  CITACIÓN GENERAL: Toda afirmación de 'fortalezas', 'áreas de mejora' y el campo 'evidencia' **DEBE ser una CITA TEXTUAL EXACTA** del trabajo del estudiante, incluso si ya fue citada en el detalle de desarrollo.
    4.  JUSTIFICACIÓN: En secciones de resumen y habilidades, indica **CLARAMENTE** POR QUÉ (según la rúbrica) la cita es una fortaleza o un área de mejora.

    ---
    INSTRUCCIONES DE DATOS CRÍTICAS:
    
    **BAREMO DE CONVERSIÓN DE PUNTAJE A NOTA (${Math.round(exigenciaPorcentaje * 100)}\% de Exigencia para 4.0):**
    **UTILIZA ESTA FÓRMULA ESTRICTAMENTE PARA ASIGNAR LA NOTA FINAL:**
    -   Puntaje Mínimo (1.0): 0 puntos
    -   Puntaje Aprobación (4.0): ${puntosAprobacion} puntos (${puntosAprobacion}/${scoreTotal})
    -   Puntaje Máximo (7.0): ${scoreTotal} puntos
    
    PAUTA CORRECTA (Recibida del cliente/Frontend):
    ${pautaCorrectaAlternativas ? JSON.stringify(pautaCorrectaAlternativas, null, 2) : 'No se proporcionó pauta correcta.'}
    
    ---
    
    INSTRUCCIONES DE FORMATO: Devuelve un JSON con la estructura exacta solicitada, sin texto explicativo.
    
    \`\`\`json
    {
      "puntaje": "PUNTAJE OBTENIDO/${scoreTotal}",
      "nota": NOTA_NUMÉRICA,
      "retroalimentacion": {
        "resumen_general": { "fortalezas": "DEBE INCLUIR CITAS TEXTUALES Y JUSTIFICACIÓN RIGUROSA.", "areas_mejora": "DEBE INCLUIR CITAS TEXTUALES Y JUSTIFICACIÓN RIGUROSA." },
        
        // CAMBIO A ESTRUCTURA DE OBJETO PARA INCLUIR LA CITA DEL ESTUDIANTE
        "detalle_puntaje_desarrollo": { 
             "P1_Simbolismo": {
                 "puntaje": "PUNTAJE/10",
                 "cita_estudiante": "CITA TEXTUAL COMPLETA DE LA RESPUESTA DEL ESTUDIANTE A ESTA PREGUNTA DE DESARROLLO.",
                 "justificacion": "JUSTIFICACIÓN DEL PUNTAJE ASIGNADO BASADO EN LA CITA Y RÚBRICA."
             },
             "P2_Transformacion_Emocional": {
                 "puntaje": "PUNTAJE/10",
                 "cita_estudiante": "CITA TEXTUAL COMPLETA DE LA RESPUESTA DEL ESTUDIANTE A ESTA PREGUNTA DE DESARROLLO.",
                 "justificacion": "JUSTIFICACIÓN DEL PUNTAJE ASIGNADO BASADO EN LA CITA Y RÚBRICA."
             }
             // Asegúrate de incluir todos los campos de desarrollo que necesites aquí
        },
        "correccion_detallada": [ {"seccion": "...", "detalle": "..."} ],
        "evaluacion_habilidades": [ {"habilidad": "...", "evaluacion": "...", "evidencia": "CITA TEXTUAL EXACTA. OBLIGATORIO."} ],
        "retroalimentacion_alternativas": [ 
            {"pregunta": "ID_PREGUNTA", "respuesta_estudiante": "...", "respuesta_correcta": "...", "estado": "Correcta/Incorrecta"} 
        ]
      }
    }
    \`\`\`
    
    Considera un nivel de flexibilidad de ${flexibilidad} (1=estricto, 5=flexible) al asignar la nota.`;
};

const promptsExpertos = {
    // 🧠 EXPERTO GENERAL (Texto): Mantiene la inferencia de OCR y la citación en el formato JSON.
    general: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => `**INSTRUCCIÓN DE TRANSCRIPCIÓN (OCR):** El siguiente texto fue extraído por el OCR (Azure Document Intelligence) y contiene la transcripción de las respuestas marcadas (alternativas/V/F) y el texto de desarrollo. **Debes utilizar esta transcripción para inferir las respuestas de alternativa y citar las respuestas de desarrollo en el formato JSON solicitado.** --- INICIO DE LA TRANSCRIPCIÓN ---\n${textoExtraido}\n--- FIN DE LA TRANSCRIPCIÓN ---\n\n${generalPromptBase(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas)}`,
    
    // 🎨 EXPERTO ARTES (CRÍTICO VISUAL): PRIORIDAD A LA DESCRIPCIÓN Y CONCEPTO.
    artes: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => {
        const visualFocusInstruction = `
        **INSTRUCCIÓN CRÍTICA DE ASIGNATURA: ARTES VISUALES - PROFESOR CRÍTICO Y CONCEPTUAL** 🎨
        Tu rol es actuar como un Profesor de Arte Constructivo. Tu objetivo es fomentar el crecimiento y la intención conceptual. Tu análisis debe ser principalmente constructivo, siguiendo esta secuencia OBLIGATORIA:
        
        **SECUENCIA OBLIGATORIA DE EVALUACIÓN VISUAL:**
        1.  **DESCRIPCIÓN FORMAL:** Describe la obra objetivamente (medio, trazo, composición, paleta, textura, etc.).
        2.  **INTERPRETACIÓN CONCEPTUAL:** Analiza la intención y el mensaje de la obra.
        3.  **APLICACIÓN DE RÚBRICA:** Engancha la interpretación conceptual con los criterios de la Rúbrica para asignar el puntaje de Desarrollo (0-10).
        
        REGLA DE ORO ESPECÍFICA DE ARTES:
        1.  PRIORIZACIÓN DEL LOGRO CONCEPTUAL: Si el logro conceptual y compositivo es evidente, la nota debe ser generosa (6.5 a 7.0). El rigor técnico tiene un peso insignificante.
        2.  CLÁUSULA DE CITACIÓN VISUAL: Las 'fortalezas', 'mejoras' y 'evidencia' deben ser **DESCRIPCIONES FORMALES Y TÉCNICAS** referidas al logro general.
        ---
        `;
        // Pasa el parámetro 'artes' para que el baremo aplique el 40%
        return visualFocusInstruction + generalPromptBase(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas, 'artes');
    },

    matematicas: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    lenguaje: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    ciencias: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    humanidades: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    ingles: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
};

async function extractTextFromImages(imageBuffers: Buffer[]): Promise<string> {
    const textPromises = imageBuffers.map(async (buffer) => {
        try {
            const processedBuffer = await sharp(buffer).jpeg().toBuffer();
            
            // Usamos el modelo más avanzado de Azure DI para la extracción de texto y marcas
            const poller = await docIntelClient.beginAnalyzeDocument("prebuilt-document", processedBuffer); 

            const result = await poller.pollUntilDone();
            let content = result.content || "";

            // Además del texto, incluimos un resumen de las marcas de selección detectadas para darle pistas a Mistral.
            if (result.pages && result.pages.length > 0) {
                const selectionMarks = result.pages.flatMap(p => p.selectionMarks || [])
                    .filter(mark => mark.state === 'selected')
                    .map(mark => `[Mark] Box: ${mark.polygon}, State: ${mark.state}`);
                
                if (selectionMarks.length > 0) {
                    content += "\n\n--- PISTAS DE MARCAS DE SELECCIÓN ---\n" + selectionMarks.join('\n');
                }
            }

            return content;
        } catch (e) {
            console.error('Error during OCR extraction:', e);
            return 'ERROR EN EXTRACCIÓN OCR DETALLADA.';
        }
    });

    const results = await Promise.all(textPromises);
    return results.join('\n\n--- FIN DE PÁGINA ---\n\n');
}

// Interfaz (se mantiene igual)
interface EvaluationResponse {
    puntaje: string;
    nota: number | string;
    retroalimentacion: {
        resumen_general: { fortalezas: string; areas_mejora: string };
        detalle_puntaje_desarrollo: { [key: string]: any }; 
        correccion_detallada: { seccion: string; detalle: string }[];
        evaluacion_habilidades: { habilidad: string; evaluacion: string; evidencia: string }[];
        retroalimentacion_alternativas: { pregunta: string; respuesta_estudiante: string; respuesta_correcta: string; estado: string }[];
    };
}

const validateEvaluationResponse = (obj: any): EvaluationResponse => {
    if (!obj || !obj.puntaje || !obj.nota || !obj.retroalimentacion || !obj.retroalimentacion.detalle_puntaje_desarrollo || !obj.retroalimentacion.retroalimentacion_alternativas) {
        throw new Error('Invalid structure returned from AI model. Missing critical fields (puntaje, detalle_puntaje_desarrollo, or retroalimentacion_alternativas).');
    }
    return obj as EvaluationResponse;
};

const cleanJson = (str: string): string => {
    const match = str.match(/```json\n([\s\S]*?)\n```/);
    if (match) {
        return match[1].trim();
    }
    return str.trim();
};


export async function POST(req: NextRequest) {
    try {
        const { fileUrls, rubrica, pauta, flexibilidad, areaConocimiento, puntajeTotal, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas } = await req.json();

        if (!rubrica || !puntajeTotal) {
            return NextResponse.json({ success: false, error: 'Faltan datos de configuración esenciales (rúbrica o puntaje total).' }, { status: 400 });
        }

        let prompt;
        let messages;
        
        const validFileUrls = fileUrls.filter((url: string) => url && url.length > 0);
        
        if (validFileUrls.length === 0) {
             const scoreTotal = Number(puntajeTotal) > 0 ? Number(puntajeTotal) : 51;
             return NextResponse.json({ 
                 success: true, 
                 puntaje: `0/${scoreTotal}`, 
                 nota: 1.0, 
                 retroalimentacion: {
                    resumen_general: { fortalezas: 'Ningún archivo de respuesta enviado.', areas_mejora: 'No se encontraron archivos de imagen válidos para evaluar.' },
                    detalle_puntaje_desarrollo: {}, 
                    correccion_detallada: [], 
                    evaluacion_habilidades: [], 
                    retroalimentacion_alternativas: []
                 }
             }, { status: 200 });
        }

        // --- MANEJO DE ARCHIVOS: ARTES vs. GENERAL ---
        
        // El bloque ARTES usará el flujo multimodal original para el análisis visual.
        if (areaConocimiento === 'artes') {
            console.log("🎨 Detectada asignatura de ARTES. Usando flujo de análisis visual.");
            
            // 1. Cargar la imagen(es) en Base64 para Visión (flujo original de Artes)
            const base64Images = await Promise.all(validFileUrls.map(async (url: string) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const resizedBuffer = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
                return `data:image/webp;base64,${resizedBuffer.toString('base64')}`;
            }));
            
            const getPrompt = promptsExpertos.artes;
            // 🚨 Pasar 'artes' aquí para que el baremo aplique el 40%
            prompt = (getPrompt as typeof promptsExpertos.artes)(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);
            
            // 2. Configurar mensaje con IMAGEN para Artes
            messages = [{
                role: 'user' as const,
                content: [
                    { type: 'text' as const, text: prompt },
                    ...base64Images.map(url => ({ type: 'image_url' as const, image_url: { url } }))
                ]
            }];
            
        } else {
            // El bloque GENERAL (LENGUAJE, CIENCIAS, etc.) usa Azure OCR para texto y Mistral para inferencia.
            console.log(`🧠 Usando Azure DI (OCR) para extracción y Mistral para inferencia y corrección.`);

            // 1. Extracción de texto y marcas con Azure DI (OCR)
            const imageBuffers = await Promise.all(validFileUrls.map(async (url: string) => {
                const response = await fetch(url); 
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }));
            const textoExtraido = await extractTextFromImages(imageBuffers);

            // 2. Crear el prompt que instruye a Mistral a INFERIR las respuestas del texto extraído.
            const getPrompt = promptsExpertos[areaConocimiento as keyof typeof promptsExpertos] || promptsExpertos.general;
            
            prompt = (getPrompt as typeof promptsExpertos.general)(textoExtraido, rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);
            
            // 3. Configurar el mensaje para Mistral AI (Solo texto)
            messages = [{
                role: 'user' as const,
                content: prompt,
            }];
        }
        
        // 4. Llamada a la API con Mistral AI
        const aiResponse = await openai.chat.completions.create({
            model: 'mistral-large-latest', 
            messages: messages as any,
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 4000
        });
        
        const content = aiResponse.choices[0].message.content;

        if (!content) { 
             return NextResponse.json({ success: false, error: 'La IA no devolvió contenido de evaluación.' }, { status: 500 });
        }

        const cleanedContent = cleanJson(content);
        let resultado;
        try {
            resultado = JSON.parse(cleanedContent);
        } catch (error) {
             console.error('Error al parsear JSON:', error);
             return NextResponse.json({ success: false, error: 'La respuesta de la IA no es un JSON válido.' }, { status: 500 });
        }

        const finalResult = validateEvaluationResponse(resultado);
        console.log('Respuesta final enviada al frontend:', finalResult);
        
        // --- AVANCE ESENCIAL: MODIFICACIÓN PARA LA VISTA PREVIA ---
        // Se mantiene intacto para que el frontend reciba toda la información clave al nivel superior.
        return NextResponse.json({ 
            success: true, 
            puntaje: finalResult.puntaje,
            nota: finalResult.nota,
            
            // CAMPOS PROMOVIDOS PARA LA VISTA PREVIA
            alternativas_corregidas: finalResult.retroalimentacion.retroalimentacion_alternativas,
            // Este campo ahora contendrá el nuevo objeto con la cita.
            detalle_desarrollo: finalResult.retroalimentacion.detalle_puntaje_desarrollo, 

            // El resto de la retroalimentación detallada
            retroalimentacion: finalResult.retroalimentacion
        });

    } catch (error) {
        console.error('Error en la evaluación:', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor. Por favor, intente de nuevo más tarde.' }, { status: 500 });
    }
}