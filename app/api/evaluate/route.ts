import { type NextRequest, NextResponse } from "next/server";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import sharp from 'sharp';
import OpenAI from "openai";

// --- Configuración de APIs ---
const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!;
const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

const openai = new OpenAI({ apiKey: MISTRAL_API_KEY, baseURL: "https://api.mistral.ai/v1" });
const docIntelClient = new DocumentAnalysisClient(AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT, new AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY));

// --- MODIFICACIÓN CLAVE: MÁXIMO RIGOR PROCEDIMENTAL PARA EVALUACIÓN DE DESARROLLO (APLICA A OCR) ---
const generalPromptBase = (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => `Actúa como un profesor universitario **EXTREMADAMENTE RIGUROSO** cuyo principal objetivo es la **VERIFICACIÓN PROCEDIMENTAL**. Tu evaluación debe ser 100% precisa en los datos y el formato, simulando un juicio experto.
    
    El puntaje máximo de la evaluación es: ${puntajeTotal} puntos.
    
    ${pauta ? `PAUTA DE RESPUESTAS (Preguntas de Desarrollo/Abiertas):\n${pauta}\n\n` : ''}
    RÚBRICA DE EVALUACIÓN (CRITERIO PARA DESARROLLO):\n${rubrica}
    
    ---
    REGLAS DE ORO PROCEDIMENTALES (OBLIGATORIO Y NO NEGOCIABLE):
    1.  EVALUACIÓN DE ALTERNATIVAS: Debes generar el array 'retroalimentacion_alternativas' que contenga **SOLO** las preguntas en las que la 'respuesta_estudiante' **NO COINCIDA** con la 'respuesta_correcta' de la pauta.
    2.  PUNTAJE DE DESARROLLO: Para generar la nota, debes aplicar la escala de 0-10 puntos de la Rúbrica de manera estricta al contenido del estudiante. **IGNORA EL NIVEL DE FLEXIBILIDAD (${flexibilidad})** para asignar el puntaje de desarrollo, utiliza solo la rúbrica.
    3.  CITACIÓN OBLIGATORIA: Es la base del rigor evaluativo. Toda afirmación de 'fortalezas', 'áreas de mejora' y el campo 'evidencia' de la tabla de habilidades **DEBE ser una CITA TEXTUAL EXACTA** del trabajo del estudiante. Si no se puede citar un fragmento para respaldar el juicio, **NO se incluye** ese juicio en el informe.
    4.  JUSTIFICACIÓN: En las secciones de resumen y habilidades, debes indicar **CLARAMENTE** POR QUÉ está bien (fortaleza) o POR QUÉ está mal (área de mejora), utilizando la rúbrica como justificación.

    ---
    INSTRUCCIONES DE DATOS:
    
    RESPUESTAS DE ALTERNATIVA A VERIFICAR:
    ${respuestasAlternativas ? `\nRespuestas del estudiante:\n${JSON.stringify(respuestasAlternativas, null, 2)}\n` : 'No se proporcionaron respuestas de alternativa.'}
    PAUTA CORRECTA EN OBJETO: ${pautaCorrectaAlternativas ? JSON.stringify(pautaCorrectaAlternativas, null, 2) : 'N/A'}
    
    ---
    
    INSTRUCCIONES DE FORMATO: Devuelve un JSON con la estructura exacta solicitada, sin texto explicativo.
    
    \`\`\`json
    {
      "puntaje": "PUNTAJE OBTENIDO/PUNTAJE TOTAL",
      "nota": NOTA_NUMÉRICA,
      "retroalimentacion": {
        "resumen_general": { "fortalezas": "DEBE INCLUIR CITAS TEXTUALES.", "areas_mejoras": "DEBE INCLUIR CITAS TEXTUALES." },
        "correccion_detallada": [ {"seccion": "...", "detalle": "..."} ],
        "evaluacion_habilidades": [ {"habilidad": "...", "evaluacion": "...", "evidencia": "CITA TEXTUAL EXACTA. OBLIGATORIO."} ],
        "retroalimentacion_alternativas": [ {"pregunta": "...", "respuesta_estudiante": "...", "respuesta_correcta": "..."} ]
      }
    }
    \`\`\`
    
    Considera un nivel de flexibilidad de ${flexibilidad} (1=estricto, 5=flexible) al asignar la nota.`;
// --- FIN DE generalPromptBase MODIFICADO ---

const promptsExpertos = {
    // General (Usa OCR y la base rigurosa)
    general: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => `A continuación se presenta LA TRANSCRIPCIÓN COMPLETA del trabajo del estudiante. **TODA tu evaluación debe basarse EXCLUSIVAMENTE en este texto.** No asumas contenido visual.\n\n--- INICIO DE LA TRANSCRIPCIÓN ---\n${textoExtraido}\n--- FIN DE LA TRANSCRIPCIÓN ---\n\n${generalPromptBase(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas)}`,
    
    // ARTES (Excepción, mantiene su foco visual sin la instrucción de OCR de texto extraído, pero usa la base rigurosa para alternativas y formato)
    artes: (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => {
        const visualFocusInstruction = `
        **INSTRUCCIÓN CRÍTICA DE ASIGNATURA: ARTES VISUALES - PROFESOR CONSTRUCTOR Y MENTOR** 🎨
        Tu rol es actuar como un Profesor de Arte Constructivo. Tu objetivo es fomentar el crecimiento y la intención conceptual. Tu análisis debe ser principalmente constructivo.
        
        REGLA DE ORO:
        1.  DESCRIPCIÓN HOLÍSTICA FORMAL OBLIGATORIA: Antes de evaluar, describe objetivamente la obra: medio, trazo, composición y paleta. Identifica el objeto central. Tu análisis debe ser coherente con esta descripción inicial.
        2.  PROHIBICIÓN DE FRAGMENTACIÓN: No evalúes detalles aislados. Refiérete siempre a Elementos Formales Completos (ej. "La consistencia del trazo", "El equilibrio de la composición").
        3.  PRIORIZACIÓN DEL LOGRO CONCEPTUAL: Si el logro conceptual y compositivo es evidente (70% o más de la rúbrica), la nota debe ser muy generosa (6.5 a 7.0). El rigor técnico tiene un peso insignificante si el concepto es exitoso.
        
        CLÁUSULA DE CITACIÓN VISUAL: Las 'fortalezas', 'mejoras' y 'evidencia' deben ser descripciones formales y técnicas referidas al logro general, no a detalles aislados.
        ---
        `;
        // Llama a la base general rigurosa, adaptando la citación a la descripción visual.
        return visualFocusInstruction + generalPromptBase(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);
    },

    // Las demás asignaturas usan el flujo de texto OCR y la base rigurosa
    matematicas: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    lenguaje: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    ciencias: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    humanidades: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    ingles: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
};

async function extractTextFromImages(imageBuffers: Buffer[]): Promise<string> { 
    // ... (sin cambios)
}
interface EvaluationResponse { /* ... (sin cambios) ... */ }
const validateEvaluationResponse = (obj: any): EvaluationResponse => { /* ... (sin cambios) ... */ };

export async function POST(req: NextRequest) {
    try {
        const { fileUrls, rubrica, pauta, flexibilidad, areaConocimiento, puntajeTotal, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas } = await req.json();

        if (!rubrica || !puntajeTotal) {
            return NextResponse.json({ success: false, error: 'Faltan datos de configuración esenciales (rúbrica o puntaje total).' }, { status: 400 });
        }

        let prompt;
        let messages;

        if (areaConocimiento === 'artes') {
            console.log("🎨 Detectada asignatura de ARTES. Usando flujo de análisis visual.");
            
            const base64Images = await Promise.all(fileUrls.map(async (url: string) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const resizedBuffer = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
                return `data:image/webp;base64,${resizedBuffer.toString('base64')}`;
            }));

            const getPrompt = promptsExpertos.artes;
            // Se pasa la pauta a la función de Artes
            prompt = getPrompt(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);
            
            messages = [{
                role: 'user' as const,
                content: [
                    { type: 'text' as const, text: prompt },
                    ...base64Images.map(url => ({ type: 'image_url' as const, image_url: { url } }))
                ]
            }];

        } else {
            console.log(`📝 Detectada asignatura ${areaConocimiento}. Usando flujo de OCR.`);

            const imageBuffers = await Promise.all(fileUrls.map(async (url: string) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }));
            
            const textoExtraido = await extractTextFromImages(imageBuffers);

            const getPrompt = promptsExpertos[areaConocimiento as keyof typeof promptsExpertos] || promptsExpertos.general;
            // Se pasa la pauta a la función de OCR
            prompt = getPrompt(textoExtraido, rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);

            messages = [{
                role: 'user' as const,
                content: prompt,
            }];
        }

        const aiResponse = await openai.chat.completions.create({
            model: "mistral-large-latest",
            messages: messages as any,
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 4000
        });
        
        const content = aiResponse.choices[0].message.content;

        if (!content) { /* ... (sin cambios) ... */ }
        const cleanJson = (str: string): string => { /* ... (sin cambios) ... */ };
        const cleanedContent = cleanJson(content);
        let resultado;
        try {
            resultado = JSON.parse(cleanedContent);
        } catch (error) { /* ... (sin cambios) ... */ }

        const finalResult = validateEvaluationResponse(resultado);
        console.log("Respuesta final enviada al frontend:", finalResult);
        return NextResponse.json({ success: true, ...finalResult });

    } catch (error) {
        console.error('Error en la evaluación:', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor. Por favor, intente de nuevo más tarde.' }, { status: 500 });
    }
}