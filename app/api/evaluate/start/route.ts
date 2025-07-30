import { type NextRequest, NextResponse } from "next/server";
import { redis } from "../../../../lib/redis";
import crypto from "crypto";

// --- PLANTILLA 1: Para Arte y Ensayos (Fuerza la citación de evidencia) ---
const promptTemplateCreativo = `
Tu tarea principal es responder en formato JSON. Eres un crítico de arte y ensayista experto con una gran sensibilidad pedagógica.

**TAREA:** Analiza la obra o texto del estudiante (en imágenes) basándote en la RÚBRICA. Tu análisis debe ser profundo, específico y justificado.

**RÚBRICA DEL PROFESOR:**
"""
{rubrica}
"""

**ESTRUCTURA DEL ANÁLISIS (OBLIGATORIO):**
1.  **Análisis de Habilidades:** Evalúa CADA criterio de la RÚBRICA. Para cada uno, indica el nivel de logro y, **OBLIGATORIAMENTE, justifícalo citando evidencia visual o textual directa de la obra**. Ejemplo: "La composición es equilibrada, lo que se evidencia en la distribución simétrica de los elementos en el tercio central de la imagen."
2.  **Cálculo de Nota:** Basado en tu análisis, asigna una nota final de 1.0 a 7.0.

**FORMATO DE RESPUESTA OBLIGATORIO (JSON):**
{
  "nota": "La nota final que consideres justa, como un número (ej: 6.8)",
  "puntaje": "Una descripción cualitativa del rendimiento (ej: 'Excelente dominio de la composición y el contraste').",
  "retroalimentacion": {
    "evaluacion_habilidades": [
      { "habilidad": "Creatividad", "evaluacion": "Lograda", "evidencia": "La idea de representar el encierro en un cubo es muy original y personal." }
    ],
    "resumen_general": {
        "fortalezas": "Un resumen de los 2-3 puntos más fuertes de la obra, basado en la evidencia citada.",
        "areas_mejora": "Un resumen constructivo de 2-3 áreas a mejorar, basado en la evidencia citada."
    }
  }
}
`;

// --- PLANTILLA 2: Para Pruebas con Pauta (Fuerza la citación de evidencia) ---
const promptTemplatePrueba = `
Tu tarea principal es responder en formato JSON. Eres un sistema experto de corrección de pruebas, meticuloso y riguroso.

**INPUTS:**
1.  **RÚBRICA:** """{rubrica}"""
2.  **PAUTA DE CORRECCIÓN:** """{pauta_correccion}"""

**ALGORITMO DE CORRECCIÓN:**
1.  **ANÁLISIS ÍTEM POR ÍTEM:** Compara las respuestas del estudiante con la PAUTA. Anota aciertos y errores de forma específica.
2.  **ANÁLISIS DE HABILIDADES:** Evalúa las habilidades de la RÚBRICA, **citando OBLIGATORIAMENTE evidencia** de las respuestas del alumno.
3.  **CÁLCULO DE PUNTAJE Y NOTA:** Calcula el puntaje total y conviértelo a nota (escala 1.0-7.0, 60% exigencia).

**FORMATO DE RESPUESTA OBLIGATORIO (JSON):**
{
  "nota": "La nota final calculada, como un número (ej: 6.2)",
  "puntaje": "El puntaje total en formato texto (ej: '42/50 puntos')",
  "retroalimentacion": {
    "correccion_detallada": [
      { "seccion": "I. Selección Múltiple", "detalle": "Pregunta 1: Correcta. Pregunta 2: Incorrecta (Correcta: C)." }
    ],
    "evaluacion_habilidades": [
      { "habilidad": "Comprensión de Texto", "evaluacion": "Lograda", "evidencia": "El estudiante demuestra esto al escribir: 'el perro simboliza...'" }
    ],
    "resumen_general": {
        "fortalezas": "Un resumen de los aciertos.",
        "areas_mejora": "Un resumen de las áreas a mejorar."
    }
  }
}
`;

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
        let selectedPromptTemplate = tipoEvaluacion === 'prueba' ? promptTemplatePrueba : promptTemplateCreativo;
        let prompt = selectedPromptTemplate.replace('{rubrica}', rubrica);
        prompt = prompt.replace('{pauta_correccion}', pauta || 'No se proporcionó una pauta de corrección específica.');
        prompt = prompt.replace('{flexibilidad}', flexibilidad?.toString() || '3');
        const messageContent: any[] = [{ type: "text", text: prompt }];
        fileUrls.forEach((url: string) => { messageContent.push({ type: "image_url", image_url: { url } }); });
        const data = await callOpenAIVisionAPI({ model: "gpt-4o", messages: [{ role: "user", content: messageContent }], response_format: { type: "json_object" }, temperature: 0.4, max_tokens: 4000, });
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("La IA devolvió una respuesta vacía.");
        const iaResult = JSON.parse(content);
        const resultData = { status: 'completed', result: { success: true, ...iaResult } };
        await redis.set(jobId, JSON.stringify(resultData), 'EX', 3600);
    } catch (error) {
        const errorData = { status: 'failed', error: error instanceof Error ? error.message : "Error desconocido" };
        await redis.set(jobId, JSON.stringify(errorData), 'EX', 3600);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fileUrls, rubrica } = body;
        if (!fileUrls || !rubrica) { return NextResponse.json({ success: false, error: "Faltan datos." }, { status: 400 }); }
        const jobId = `eval-${crypto.randomUUID()}`;
        await redis.set(jobId, JSON.stringify({ status: 'processing' }), 'EX', 3600);
        runEvaluation(jobId, body);
        return NextResponse.json({ success: true, jobId });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Error interno del servidor." }, { status: 500 });
    }
}