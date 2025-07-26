// En: app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from "next/server";

async function callOpenAIVisionAPI(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`OpenAI API error: ${errorBody.error?.message || response.statusText}`);
  }
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, rubrica } = await request.json();
    if (!imageUrls || imageUrls.length === 0 || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (URLs de imagen o rúbrica)." }, { status: 400 });
    }
    const imageContent = imageUrls.map((url: string) => ({
      type: "image_url",
      image_url: { url: url },
    }));
    const prompt = `Evalúa el conjunto de ${imageUrls.length} imágenes adjuntas basándote en la rúbrica. Responde únicamente con un objeto JSON con la estructura: {"retroalimentacion": "...", "puntaje": "...", "nota": X.X}`;
    
    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...imageContent] }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("La IA devolvió una respuesta vacía.");
    const iaResult = JSON.parse(content);
    return NextResponse.json({ success: true, ...iaResult });
  } catch (error) {
    return NextResponse.json({ success: false, error: `La IA de visión falló. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}` }, { status: 500 });
  }
}