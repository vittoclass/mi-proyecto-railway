import { type NextRequest, NextResponse } from "next/server";
import { redis } from "../../../../lib/redis";
import crypto from "crypto";

// --- PLANTILLA DE PROMPT MÁS ROBUSTA Y DIRECTA ---
const systemPromptTemplate = `
Tu tarea principal es responder únicamente con un objeto JSON válido. Analiza las imágenes de la evaluación de un estudiante según la Rúbrica y la Pauta, y rellena la siguiente estructura JSON.

**RÚBRICA (Criterios):**
"""
{rubrica}
"""

**PAUTA DE CORRECCIÓN (Respuestas correctas y puntajes):**
"""
{pauta_correccion}
"""

**INSTRUCCIONES:**
1.  **Calcula un puntaje** comparando las respuestas del estudiante con la Pauta.
2.  **Convierte el puntaje a una nota** de 1.0 a 7.0 (60% de exigencia para el 4.0).
3.  **Evalúa las habilidades** de la Rúbrica. Para cada una, indica si está 'Lograda', 'Parcialmente Lograda' o 'Por Mejorar' y **justifícalo OBLIGATORIAMENTE citando una frase corta textual** del trabajo del estudiante como evidencia.
4.  **Genera una corrección detallada** para los ítems incorrectos.

**FORMATO DE RESPUESTA OBLIGATORIO (JSON):**
{
  "nota": "La nota final calculada como un número (ej: 6.5)",
  "puntaje": "El puntaje total en formato texto (ej: '45/50 puntos')",
  "retroalimentacion": {
    "correccion_detallada": [
      { "seccion": "I. Selección Múltiple", "detalle": "Pregunta 2: Incorrecta (Correcta: C). Pregunta 5: Incorrecta (Correcta: A)." }
    ],
    "evaluacion_habilidades": [
      { "habilidad": "Comprensión de Texto", "evaluacion": "Lograda", "evidencia": "El estudiante demuestra esto al escribir: 'el perro simboliza la soledad...'" }
    ],
    "resumen_general": {
        "fortalezas": "Un resumen en 2-3 puntos de los aciertos más notables, basado en la evidencia.",
        "areas_mejora": "Un resumen en 2-3 puntos de las áreas más importantes a mejorar, basado en la evidencia."
    }
  }
}
`;

// --- El resto del archivo no cambia, pero se incluye completo por seguridad ---
async function callOpenAIVisionAPI(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload), });
  if (!response.ok) { const errorBody = await response.json().catch(() => ({ message: response.statusText })); throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`); }
  return response.json();
}

async function runEvaluation(jobId: string, payload: any) {
    const { fileUrls, rubrica, pauta, flexibilidad, tipoEvaluacion } = payload;
    try {
        console.log(`[Job ${jobId}] Iniciando evaluación...`);
        let prompt = systemPromptTemplate.replace('{rubrica}', rubrica);
        prompt = prompt.replace('{pauta_correccion}', pauta || 'No se proporcionó una pauta de corrección específica.');
        
        const messageContent: any[] = [{ type: "text", text: prompt }];
        fileUrls.forEach((url: string) => { messageContent.push({ type: "image_url", image_url: { url } }); });
        
        const data = await callOpenAIVisionAPI({
            model: "gpt-4o",
            messages: [{ role: "user", content: messageContent }],
            response_format: { type: "json_object" },
            temperature: 0.3, // Temperatura baja para consistencia
            max_tokens: 4000,
        });

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("La IA devolvió una respuesta vacía.");
        }
        
        let iaResult;
        try {
            iaResult = JSON.parse(content);
        } catch (e) {
            console.error(`[Job ${jobId}] Error al parsear JSON de la IA. Contenido:`, content);
            throw new Error("La IA devolvió un formato no válido.");
        }
        
        const resultData = { status: 'completed', result: { success: true, ...iaResult } };
        await redis.set(jobId, JSON.stringify(resultData), 'EX', 3600);
        console.log(`[Job ${jobId}] Evaluación completada y guardada en Redis.`);

    } catch (error) {
        console.error(`[Job ${jobId}] Falló la ejecución en segundo plano:`, error);
        const errorData = { status: 'failed', error: error instanceof Error ? error.message : "Error desconocido" };
        await redis.set(jobId, JSON.stringify(errorData), 'EX', 3600);
    }
}

export async function POST(request: NextRequest) {
    console.log("API /api/evaluate/start: Petición POST recibida.");
    try {
        const body = await request.json();
        const { fileUrls, rubrica } = body;
        if (!fileUrls || !rubrica) { return NextResponse.json({ success: false, error: "Faltan datos en la petición." }, { status: 400 }); }
        const jobId = `eval-${crypto.randomUUID()}`;
        console.log(`API /start: Creando Job con ID: ${jobId}`);
        await redis.set(jobId, JSON.stringify({ status: 'processing' }), 'EX', 3600);
        console.log(`API /start: Job ${jobId} guardado en Redis como 'processing'.`);
        runEvaluation(jobId, body);
        console.log(`API /start: Respondiendo inmediatamente con Job ID ${jobId}.`);
        return NextResponse.json({ success: true, jobId });
    } catch (error) {
        console.error("API /start: Error fatal en el endpoint:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor al iniciar la evaluación." }, { status: 500 });
    }
}