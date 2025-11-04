import { type NextRequest, NextResponse } from "next/server";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import sharp from 'sharp';
import OpenAI from "openai";
// -----------------------------------------------------------------------------------
// === Se omiten las importaciones estáticas para evitar el error de compilación ===

const PDFJS_VERSION = '3.11.174';

// --- Configuración de APIs (Versión segura sin el operador '!') ---
const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Se quita la inicialización global de openai y docIntelClient. Se inicializarán dentro de POST.

// --- PROMPT BASE (SIN CAMBIOS) ---
const generalPromptBase = (rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }, areaConocimiento?: string) => {
    const scoreTotal = Number(puntajeTotal) > 0 ? Number(puntajeTotal) : 51;
    const exigenciaPorcentaje = areaConocimiento === 'artes' ? 0.40 : 0.50;
    const puntosAprobacion = Math.ceil(scoreTotal * exigenciaPorcentaje);
    const totalAlternativas = pautaCorrectaAlternativas ? Object.keys(pautaCorrectaAlternativas).length : 'N/A';

    return `Actúa como un profesor universitario **EXTREMADAMENTE RIGUROSO** cuyo principal objetivo es la **VERIFICACIÓN PROCEDIMENTAL Y LITERAL**. Tu evaluación debe ser 100% precisa en los datos y el formato, simulando un juicio experto.
    
    El puntaje máximo de la evaluación es: ${scoreTotal} puntos.
    
    ${pauta ? `PAUTA DE RESPUESTAS (Preguntas de Desarrollo/Abiertas):\n${pauta}\n\n` : ''}`
    + `RÚBRICA DE EVALUACIÓN (CRITERIO PARA DESARROLLO - APLICAR ESCALA 0-10 ESTRICTAMENTE):\n${rubrica}
    
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
        "detalle_puntaje_desarrollo": { 
              "P1_Simbolismo": {
                "puntaje": "PUNTAJE/10",
                "cita_estudiante": "CITA TEXTUAL COMPLETA DE LA RESPUESTA DEL ESTUDIANTE A ESTA PREGUNTA DE DESARROLLO.",
                "justificacion": "JUSTIFICACIÓN DEL PUNTAJE ASIGNADO BASADO EN LA CITA Y RÚBRICA."
              }
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
    general: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => `**INSTRUCCIÓN DE TRANSCRIPCIÓN (OCR):** El siguiente texto fue extraído por el OCR (Azure Document Intelligence) y contiene la transcripción de las respuestas marcadas (alternativas/V/F) y el texto de desarrollo. **Debes utilizar esta transcripción para inferir las respuestas de alternativa y citar las respuestas de desarrollo en el formato JSON solicitado.** --- INICIO DE LA TRANSCRIPCIÓN ---\n${textoExtraido}\n--- FIN DE LA TRANSCRIPCIÓN ---\n\n${generalPromptBase(rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas)}`,
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
        return visualFocusInstruction + generalPromptBase(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas, 'artes');
    },
    matematicas: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    lenguaje: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    ciencias: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    humanidades: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
    ingles: (textoExtraido: string, rubrica: string, pauta: string, puntajeTotal: number, flexibilidad: number, itemsEsperados?: string, nombreEstudiante?: string, respuestasAlternativas?: { [key: string]: string }, pautaCorrectaAlternativas?: { [key: string]: string }) => promptsExpertos.general(textoExtraido, rubrica, pauta, puntajeTotal, flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas),
};

// === FUNCIONES DE EXTRACCIÓN DE DOCUMENTOS DIGITALES (CON REQUIRE DINÁMICO) ===

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
        // SOLUCIÓN RADICAL: Se usa require directo para evadir el static analysis de Webpack/Next.js
        const pdfjs = require('pdfjs-dist'); 
        
        // Configuración del worker de forma segura para Node.js (necesario para pdfjs en Node)
        if (typeof (pdfjs as any).GlobalWorkerOptions !== 'undefined') {
             // Carga el worker para Node.
            (pdfjs as any).GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.js');
        }

        const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str || '')
                .join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    } catch (error) {
        console.error('Error extrayendo texto de PDF digital:', error);
        return '';
    }
}

async function extractTextFromDigitalDocument(buffer: Buffer, mimeType: string): Promise<string> {
    try {
        if (mimeType === 'application/pdf') {
            const text = await extractTextFromPDF(buffer);
            if (text.trim().length > 50) {
                return text; 
            }
            // Si la extracción directa de texto falla o es muy corta, se devuelve '' para forzar el OCR
            return ''; 
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // SOLUCIÓN RADICAL: require() para cargar Mammoth
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            // SOLUCIÓN RADICAL: require() para cargar XLSX
            const XLSX = require('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let text = '';
            workbook.SheetNames.forEach((sheetName: string) => {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                text += csv + '\n';
            });
            return text;
        }
    } catch (e) {
        console.warn(`Fallo en la extracción directa de ${mimeType}:`, e);
    }
    return '';
}

// === FUNCIÓN ACTUALIZADA: decide entre OCR y extracción directa (CORRECCIÓN CRÍTICA DE PDF) ===

async function extractTextFromFiles(fileBuffers: { buffer: Buffer; mimeType: string }[], docIntelClient: DocumentAnalysisClient): Promise<string> {
    let allText = '';
    let needsOCR = false;
    // CRÍTICO: Ahora guarda objetos { buffer, mimeType } para que la función OCR sepa qué procesar.
    const ocrFiles: { buffer: Buffer; mimeType: string }[] = []; 

    for (const { buffer, mimeType } of fileBuffers) {
        if (mimeType.startsWith('image/')) {
            ocrFiles.push({ buffer, mimeType });
            needsOCR = true;
        } else if (mimeType === 'application/pdf') {
            const directText = await extractTextFromDigitalDocument(buffer, mimeType);
            if (directText.trim()) {
                allText += directText + '\n\n--- FIN DE PÁGINA ---\n\n';
            } else {
                // Si el PDF es escaneado o protegido, el texto directo falla, se envía a OCR
                ocrFiles.push({ buffer, mimeType }); // Se añade el PDF a la cola OCR
                needsOCR = true;
            }
        } else if (mimeType.includes('officedocument')) {
            const text = await extractTextFromDigitalDocument(buffer, mimeType);
            allText += text + '\n\n--- FIN DE PÁGINA ---\n\n';
        } else {
            console.warn(`Archivo ignorado: Tipo MIME no soportado para extracción de texto: ${mimeType}`);
        }
    }

    if (needsOCR && ocrFiles.length > 0) {
        console.log(`Ejecutando OCR de Azure para ${ocrFiles.length} archivo(s) (Imágenes/PDF Escaneados)...`);
        const ocrText = await extractTextFromImages(ocrFiles, docIntelClient); 
        allText += ocrText;
    }

    return allText.trim() || 'NO SE PUDO EXTRAER TEXTO.';
}

// === FUNCIÓN OCR con Azure (CORRECCIÓN CRÍTICA DE PDF) ===

async function extractTextFromImages(ocrFiles: { buffer: Buffer; mimeType: string }[], docIntelClient: DocumentAnalysisClient): Promise<string> {
    const textPromises = ocrFiles.map(async ({ buffer, mimeType }) => {
        try {
            let processedBuffer = buffer;
            
            // CORRECCIÓN CRÍTICA: Solo se aplica sharp si el archivo es una imagen (PNG/JPEG/etc.).
            // Los PDFs se envían directamente como buffer a Azure sin manipulación de sharp.
            if (mimeType.startsWith('image/')) {
                // Procesar imagen a JPEG para reducir tamaño y asegurar compatibilidad en OCR.
                processedBuffer = await sharp(buffer).jpeg().toBuffer(); 
            }
            
            const poller = await docIntelClient.beginAnalyzeDocument("prebuilt-read", processedBuffer);
            const result = await poller.pollUntilDone();
            let content = result.content || "";
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
            console.error('Error durante la extracción OCR:', e);
            return 'ERROR DE EXTRACCIÓN OCR. Asegúrate de que el PDF o imagen contenga texto legible.';
        }
    });
    const results = await Promise.all(textPromises);
    return results.join('\n\n--- FIN DE PÁGINA ---\n\n');
}


// === INTERFACES Y UTILIDADES (SIN CAMBIOS) ===
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
    if (match) return match[1].trim();
    return str.trim();
};

// === ENDPOINT PRINCIPAL (SIN CAMBIOS EN LÓGICA DE EVALUACIÓN) ===

export async function POST(req: NextRequest) {
    // 1. **VERIFICACIÓN Y FALLO CONTROLADO**
    if (!MISTRAL_API_KEY || !AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || !AZURE_DOCUMENT_INTELLIGENCE_KEY) {
        console.error("ERROR CRÍTICO: Una o más claves de API son nulas. Verifique .env.local y reinicie el servidor.");
        return NextResponse.json(
            { success: false, error: "Error de configuración interna del servidor. Faltan claves de API. Verifique su archivo .env.local." },
            { status: 500 }
        );
    }
    
    // 2. **INICIALIZACIÓN SEGURA DE CLIENTES**
    const openai = new OpenAI({ apiKey: MISTRAL_API_KEY!, baseURL: "https://api.mistral.ai/v1" });
    const docIntelClient = new DocumentAnalysisClient(AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!, new AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY!));

    try {
        const { fileUrls, rubrica, pauta, flexibilidad, areaConocimiento, puntajeTotal, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas, fileMimeTypes } = await req.json();

        if (!rubrica || !puntajeTotal) {
            return NextResponse.json({ success: false, error: 'Faltan datos de configuración esenciales (rúbrica o puntaje total).' }, { status: 400 });
        }

        const validFileUrls = fileUrls.filter((url: string) => url && url.length > 0);
        const mimeTypes = fileMimeTypes || validFileUrls.map(() => 'application/pdf');

        if (validFileUrls.length === 0) {
            const scoreTotal = Number(puntajeTotal) > 0 ? Number(puntajeTotal) : 51;
            return NextResponse.json({ 
                success: true, 
                puntaje: `0/${scoreTotal}`, 
                nota: 1.0, 
                retroalimentacion: {
                    resumen_general: { fortalezas: 'Ningún archivo de respuesta enviado.', areas_mejora: 'No se encontraron archivos válidos para evaluar.' },
                    detalle_puntaje_desarrollo: {}, 
                    correccion_detallada: [], 
                    evaluacion_habilidades: [], 
                    retroalimentacion_alternativas: []
                }
            }, { status: 200 });
        }

        // --- MANEJO DE ARCHIVOS: ARTES vs. GENERAL ---
        if (areaConocimiento === 'artes') {
            console.log("🎨 Detectada asignatura de ARTES. Usando flujo de análisis visual (solo imágenes).");
            
            const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
            const validImageUrls = validFileUrls.filter((_: string, i: number) => 
  imageMimeTypes.some(m => mimeTypes[i]?.includes(m))
);
            const base64Images = await Promise.all(validImageUrls.map(async (url: string) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const resizedBuffer = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
                return `data:image/webp;base64,${resizedBuffer.toString('base64')}`;
            }));
            
            if (base64Images.length === 0) {
                 return NextResponse.json({ success: false, error: 'Asignatura ARTES requiere imágenes (JPG/PNG/WEBP), pero no se encontraron archivos compatibles.' }, { status: 400 });
            }

            const getPrompt = promptsExpertos.artes;
            const prompt = (getPrompt as typeof promptsExpertos.artes)(rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);
            
            const messages = [{
                role: 'user' as const,
                content: [
                    { type: 'text' as const, text: prompt },
                    ...base64Images.map(url => ({ type: 'image_url' as const, image_url: { url } }))
                ]
            }];
            
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
            return NextResponse.json({ 
                success: true, 
                puntaje: finalResult.puntaje,
                nota: finalResult.nota,
                alternativas_corregidas: finalResult.retroalimentacion.retroalimentacion_alternativas,
                detalle_desarrollo: finalResult.retroalimentacion.detalle_puntaje_desarrollo, 
                retroalimentacion: finalResult.retroalimentacion
            });
        } else {
            // --- Flujo de Evaluación General (TEXTO: OCR, PDF, DOCX, XLSX) ---
            
            // 1. Descargar buffers y MIME types
            const fileBuffers = await Promise.all(validFileUrls.map(async (url: string, i: number) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return { buffer: Buffer.from(arrayBuffer), mimeType: mimeTypes[i] || 'application/octet-stream' };
            }));

            // 2. Extraer texto (directo o OCR) - PASANDO docIntelClient
            const textoExtraido = await extractTextFromFiles(fileBuffers, docIntelClient);
            
            if (textoExtraido === 'NO SE PUDO EXTRAER TEXTO.') {
                 return NextResponse.json({ success: false, error: 'No se pudo extraer texto del archivo subido. Asegúrese de que no esté protegido o sea ilegible.' }, { status: 400 });
            }

            // 3. Generar Prompt y llamar a la IA
            const getPrompt = promptsExpertos[areaConocimiento as keyof typeof promptsExpertos] || promptsExpertos.general;
            const prompt = (getPrompt as typeof promptsExpertos.general)(textoExtraido, rubrica, pauta, Number(puntajeTotal), flexibilidad, itemsEsperados, nombreEstudiante, respuestasAlternativas, pautaCorrectaAlternativas);
            
            const aiResponse = await openai.chat.completions.create({
                model: 'mistral-large-latest', 
                messages: [{ role: 'user', content: prompt }],
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
            return NextResponse.json({ 
                success: true, 
                puntaje: finalResult.puntaje,
                nota: finalResult.nota,
                alternativas_corregidas: finalResult.retroalimentacion.retroalimentacion_alternativas,
                detalle_desarrollo: finalResult.retroalimentacion.detalle_puntaje_desarrollo, 
                retroalimentacion: finalResult.retroalimentacion
            });
        }
    } catch (error) {
        console.error('Error en la evaluación:', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor. Por favor, intente de nuevo más tarde.' }, { status: 500 });
    }
}