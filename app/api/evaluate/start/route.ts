// app/api/evaluate/start/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import crypto from "crypto";

// NOTA: Aquí pegamos la lógica de la IA que antes estaba en el otro archivo
const systemPromptTemplate = `...`; // Tu prompt ultra-específico va aquí

async function callOpenAIVisionAPI(payload: any) {
    // ... La función que llama a OpenAI va aquí
}

async function runEvaluation(jobId: string, payload: any) {
    const { fileUrls, rubrica, pauta, flexibilidad } = payload;
    try {
        // 1. Construir el prompt
        let prompt = systemPromptTemplate.replace('{rubrica}', rubrica);
        prompt = prompt.replace('{pauta_correccion}', pauta || 'N/A');
        prompt = prompt.replace('{flexibilidad}', flexibilidad?.toString() || '3');

        const messageContent: any[] = [{ type: "text", text: prompt }];
        fileUrls.forEach((url: string) => { messageContent.push({ type: "image_url", image_url: { url } }); });

        // 2. Llamar a la IA
        const data = await callOpenAIVisionAPI({
            model: "gpt-4o",
            messages: [{ role: "user", content: messageContent }],
            response_format: { type: "json_object" },
            temperature: 0.5,
            max_tokens: 4000,
        });

        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("La IA devolvió una respuesta vacía.");
        
        const iaResult = JSON.parse(content);

        // 3. Guardar el resultado en Redis
        const resultData = { status: 'completed', result: { success: true, ...iaResult } };
        await redis.set(jobId, JSON.stringify(resultData), 'EX', 3600); // Expira en 1 hora

    } catch (error) {
        console.error(`Error en el Job ${jobId}:`, error);
        const errorData = { status: 'failed', error: error instanceof Error ? error.message : "Error desconocido" };
        await redis.set(jobId, JSON.stringify(errorData), 'EX', 3600);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fileUrls, rubrica } = body;

        if (!fileUrls || !rubrica) {
            return NextResponse.json({ success: false, error: "Faltan datos." }, { status: 400 });
        }

        const jobId = `eval-${crypto.randomUUID()}`;

        // Guardamos el estado inicial en Redis
        await redis.set(jobId, JSON.stringify({ status: 'processing' }), 'EX', 3600);

        // **IMPORTANTE:** No usamos 'await' aquí.
        // Esto ejecuta la evaluación en segundo plano y permite que la respuesta sea inmediata.
        runEvaluation(jobId, body);

        // Devolvemos el ID de la tarea inmediatamente
        return NextResponse.json({ success: true, jobId });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Error al iniciar la evaluación." }, { status: 500 });
    }
}