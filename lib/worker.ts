// lib/worker.ts
import { redis } from './redis'; // Importa la conexión a Redis.
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function processJobs() {
    console.log("Worker iniciado, esperando trabajos...");
    while (true) {
        try {
            // Espera un trabajo de la cola 'evaluation-jobs'
            const [listName, jobId] = await redis.blpop('evaluation-jobs', 0);
            
            // Carga los detalles del trabajo desde Redis
            const jobData = await redis.get(jobId);
            if (!jobData) {
                console.error(`Error: Datos del trabajo ${jobId} no encontrados.`);
                continue;
            }
            const job = JSON.parse(jobData);
            console.log(`Procesando trabajo: ${jobId}`);

            // === Lógica de la IA (DEBES PERSONALIZAR ESTO) ===
            const { payload } = job;
            const { files, rubrica, pauta, flexibilidad, ...metadata } = payload;
            
            const prompt = `Evalúa el siguiente trabajo con la siguiente rúbrica:\n\nRubrica: ${rubrica}\n\nTrabajo del estudiante: ${files[0]}\n\nRespuesta correcta (opcional): ${pauta}\n\nNivel de flexibilidad: ${flexibilidad}`;

            const completion = await openai.chat.completions.generate({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "Eres un asistente de evaluación para profesores, tu misión es evaluar de manera precisa y constructiva el trabajo de un estudiante. Siempre incluye en tu respuesta un informe completo y conciso. Asegúrate de incluir el puntaje y la nota. En tu respuesta JSON, utiliza los campos 'informe_original', 'puntaje' y 'nota'." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const aiResult = JSON.parse(completion.choices[0].message.content);

            // === Actualiza el estado del trabajo en Redis ===
            await redis.set(`job:${jobId}:result`, JSON.stringify(aiResult));
            await redis.set(`job:${jobId}:status`, 'completed');

            console.log(`Evaluación completada para Job ID: ${jobId}`);
            
        } catch (error) {
            console.error("Error en el worker:", error);
            // Si algo falla, marca el trabajo como fallido
            // await redis.set(`job:${jobId}:status`, 'failed');
        }
    }
}

// Inicia el worker
processJobs();