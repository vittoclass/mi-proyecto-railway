import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import OpenAI from "openai";
import { findBestMatch } from "string-similarity"; // Asegúrate de tener 'string-similarity' instalado

// --- Configuración de APIs ---
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;
const openai = new OpenAI({ apiKey: MISTRAL_API_KEY, baseURL: "https://api.mistral.ai/v1" });

// --- Funciones de Azure OCR (MANTENER SU IMPLEMENTACIÓN ORIGINAL) ---
async function ocrAzure(imageBuffer: Buffer): Promise<string> {
    if (!AZURE_VISION_ENDPOINT || !AZURE_VISION_KEY) {
        throw new Error("Credenciales de Azure no configuradas en el servidor.");
    }
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
    if (analysisResult.status === "succeeded" && analysisResult.analyzeResult?.readResults) {
        analysisResult.analyzeResult.readResults.forEach(readResult => {
            readResult.lines.forEach(line => {
                fullText += line.text + " ";
            });
        });
    }
    return fullText.trim();
}

// --- FUNCIÓN ORIGINAL: FALLBACK DE IA (Modo 2) ---
// 🚀 MEJORA: Prompt más estricto para excluir nombres de profesores y asegurar formato array de Nombres de ALUMNOS.
async function extractNameWithAI(combinedText: string): Promise<string[]> {
    const prompt = `Actúa como un extractor de datos de un examen o trabajo. Tu ÚNICO OBJETIVO es identificar y extraer los nombres completos de los estudiantes que realizaron el examen. 
    
    INSTRUCCIONES CLAVE:
    1. EXCLUYE de la extracción cualquier nombre que esté asociado o etiquetado como "Profesor", "Docente", "Asignatura", "Curso", "Prueba", "Evaluación" o "Fecha". Concéntrate SÓLO en los nombres de los ALUMNOS.
    2. Devuelve un array de strings llamado 'suggestions' con TODOS los nombres de ALUMNOS que encuentres (individuales o grupales), en el orden en que aparecen.
    
    Si solo encuentras un nombre de alumno, devuélvelo como el único elemento en el array. Si encuentras varios nombres, devuelve todos los nombres identificados (máximo 7).
    
    Tu única respuesta debe ser un objeto JSON.
    
    Texto OCR para análisis: ${combinedText}
    
    Ejemplo de respuesta (trabajo grupal): 
    {"suggestions": ["Juan Pérez", "Ana Gómez", "Carlos Rojas"]}
    `;

    try {
        const aiResponse = await openai.chat.completions.create({
            model: "mistral-large-latest",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 500
        });

        const content = aiResponse.choices[0].message.content;
        // Se añade una comprobación para asegurar que 'content' no es null.
        if (!content) {
            console.error("❌ La respuesta de la IA para extraer nombres vino vacía (null).");
            return [];
        }
        const match = content.match(/({[\s\S]*})/);
        const cleanedContent = match ? match[1] : "{\"suggestions\":[]}";
        const result = JSON.parse(cleanedContent);

        // Se asegura de que 'suggestions' sea un array antes de devolverlo.
        return Array.isArray(result.suggestions) ? result.suggestions : [];
    } catch (error) {
        console.error("❌ Fallback de IA falló:", error);
        return []; 
    }
}

// --- FUNCIÓN PRINCIPAL: FUZZY MATCHING (Modo 1) ---
function findTopNameSuggestions(ocrText: string, nameList: string[]): string[] {
    const ratings: { target: string, rating: number }[] = [];
    
    nameList.forEach(name => {
        const match = findBestMatch(name, [ocrText]);
        const rating = match.ratings[0].rating;
        ratings.push({ target: name, rating });
    });

    ratings.sort((a, b) => b.rating - a.rating);
    
    let topSuggestions: string[] = ratings.slice(0, 3).map(r => r.target);
    topSuggestions = Array.from(new Set(topSuggestions));

    return topSuggestions;
}


export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll("files") as File[];
        
        // --- INICIO DEL CÓDIGO CRÍTICO CON FIX DE ESTABILIDAD ---
        const nameListJson = formData.get("nameList") as string | null;
        let nameList: string[] = [];
        
        if (nameListJson) {
            try {
                // El FIX: Intentamos parsear el JSON dentro de un bloque try-catch.
                const parsedList = JSON.parse(nameListJson);
                
                // Aseguramos que sea un array de strings.
                if (Array.isArray(parsedList)) {
                    nameList = parsedList;
                } else {
                    console.error("[API /extract-name] nameList JSON era válido, pero no era un array.");
                }
            } catch (e) {
                // Si el JSON es inválido (la causa más común del 500), capturamos el error
                // y nameList queda como [], forzando el MODO 2 (Fallback de IA).
                console.error("[API /extract-name] ❌ ERROR CRÍTICO AL PARSEAR JSON. Fallando a MODO 2.", e);
                // El error está contenido, el código sigue ejecutándose.
            }
        }
        // --- FIN DEL CÓDIGO CRÍTICO CON FIX ---

        const isNameListAvailable = nameList.length > 0;

        console.log(`[API /extract-name] Nombres en lista de clase disponibles: ${isNameListAvailable}`);
        
        if (!files.length) {
            return NextResponse.json({ success: false, error: "No se proporcionaron archivos" }, { status: 400 });
        }

        // 2. Extracción de texto con Azure
        let combinedText = "";
        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            combinedText += await ocrAzure(buffer) + "\n\n---\n\n";
        }
        
        if (combinedText.trim() === "") {
             console.error("[API /extract-name] ERROR: Azure OCR no extrajo texto.");
             return NextResponse.json({ success: true, suggestions: [] });
        }

        let suggestions: string[] = [];

        if (isNameListAvailable) {
            // --- MODO 1: FUZZY MATCHING (Rápido) ---
            console.log("[API /extract-name] 🚀 USANDO MODO 1: Fuzzy Matching (Lista de Nombres).");
            suggestions = findTopNameSuggestions(combinedText, nameList); 
        } else {
            // --- MODO 2: FALLBACK CON IA (Lento, pero seguro) ---
            console.log("[API /extract-name] 🐌 USANDO MODO 2: Fallback con IA (Sin Lista de Nombres).");
            suggestions = await extractNameWithAI(combinedText);
        }
        
        console.log(`[API /extract-name] Sugerencias finales devueltas:`, suggestions);
        
        // 3. Retorno de Sugerencias
        return NextResponse.json({ success: true, suggestions }); 

    } catch (error) {
        console.error("[API /extract-name] ❌ ERROR CRÍTICO EN EL BLOQUE POST:", error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor";
        // Si el error es una falla de credenciales, igual devuelve 500.
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}