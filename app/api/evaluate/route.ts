import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// Creamos un cliente de Supabase para el SERVIDOR usando claves secretas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ¡OJO: Esta es una nueva variable de entorno!
);

async function callOpenAIVisionAPI(payload: any) {
    const apiKey = process.env.OPENAI_API_KEY!;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("OpenAI API error");
    return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { evaluationId } = await request.json();
    if (!evaluationId) throw new Error("No se proporcionó ID de evaluación.");

    // 1. La API busca la evaluación pendiente en la base de datos
    const { data: evaluation, error: fetchError } = await supabaseAdmin
      .from('evaluaciones')
      .select('*')
      .eq('id', evaluationId)
      .single();

    if (fetchError || !evaluation) throw new Error("No se encontró la evaluación en la base de datos.");

    // 2. Llama a la IA con los datos recuperados
    const prompt = `Evalúa la imagen en la URL: ${evaluation.imagen}. Rúbrica: """${evaluation.rubrica}""". Responde en JSON: {"retroalimentacion": "...", "puntaje": "...", "nota": X.X}`;
    const iaData = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { "url": evaluation.imagen } }] }],
      response_format: { type: "json_object" },
    });

    const iaResult = JSON.parse(iaData.choices[0].message.content);

    // 3. Actualiza el registro en la base de datos con el resultado de la IA
    const { error: updateError } = await supabaseAdmin
      .from('evaluaciones')
      .update({
        retroalimentacion: iaResult.retroalimentacion,
        puntaje: iaResult.puntaje,
        nota: iaResult.nota,
        status: 'completed' // Cambiamos el estado
      })
      .eq('id', evaluationId);

    if (updateError) throw new Error("No se pudo actualizar la evaluación con el resultado de la IA.");

    return NextResponse.json({ success: true, result: iaResult });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}