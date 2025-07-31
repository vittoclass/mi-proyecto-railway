import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";

// Asegúrate de que estas variables estén en tu archivo .env.local
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

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
    if (analysisResult.status === "succeeded" && analysisResult.analyzeResult) {
        for (const page of analysisResult.analyzeResult.readResults) {
            for (const line of page.lines) {
                fullText += line.text + "\n";
            }
        }
    }
    return fullText;
}

async function callMistralAPI(payload: any) {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Mistral API Error:", errorBody);
        throw new Error(`Error en la API de Mistral: ${response.statusText}`);
    }
    return response.json();
}

async function extractNameWithAI(text: string): Promise<string[]> {
    if (!text.trim()) return [];
    const prompt = `
    Analiza el siguiente texto extraído de un documento escolar y extrae hasta 3 posibles nombres completos de estudiantes que encuentres.
    - Corrige errores obvios de OCR (ej: "Jvan" -> "Iván").
    - Si encuentras variaciones o no estás seguro, inclúyelas.
    - Responde únicamente con un objeto JSON que contenga una clave "sugerencias", que sea un array de strings. Ejemplo: {"sugerencias": ["Juan Pérez", "Juana Pereira"]}.
    - Si no encuentras ningún nombre, responde con un array vacío: {"sugerencias": []}.
    TEXTO: """${text}"""
    `;
    const data = await callMistralAPI({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
    });
    const content = data?.choices?.[0]?.message?.content || '{"sugerencias": []}';
    try {
        const result = JSON.parse(content);
        return result.sugerencias || [];
    } catch (e) {
        console.error("Error al parsear JSON de Mistral:", content);
        return [];
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll("files") as File[];
        console.log(`[API /extract-name] Recibidos ${files.length} archivos para procesar.`);
        if (!files.length) {
            return NextResponse.json({ success: false, error: "No se proporcionaron archivos" }, { status: 400 });
        }
        let combinedText = "";
        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            combinedText += await ocrAzure(buffer) + "\n\n---\n\n";
        }
        console.log("[API /extract-name] Texto extraído por OCR antes de enviar a la IA:");
        console.log("=======================================");
        console.log(combinedText.trim() === "" ? "¡El texto está VACÍO!" : combinedText);
        console.log("=======================================");
        const suggestions = await extractNameWithAI(combinedText);
        console.log(`[API /extract-name] Sugerencias finales de la IA:`, suggestions);
        return NextResponse.json({ success: true, suggestions });
    } catch (error) {
        console.error("[API /extract-name] Error crítico en el bloque POST:", error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}