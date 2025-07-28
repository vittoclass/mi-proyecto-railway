// app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from "next/server";

async function callOpenAIVisionAPI(payload: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada en el servidor.");

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
    const { fileUrls, rubrica } = await request.json();

    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0 || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos en la petición (se necesita un array 'fileUrls' y una 'rubrica')." }, { status: 400 });
    }

    const prompt = `Evalúa el siguiente conjunto de imágenes de un trabajo escrito. Rúbrica: """${rubrica}""". Responde en un único JSON con esta estructura: {"retroalimentacion": "...", "puntaje": "...", "nota": X.X}`;

    // Construir el contenido del mensaje con el prompt y múltiples imágenes
    const messageContent: any[] = [{ type: "text", text: prompt }];
    fileUrls.forEach(url => {
      messageContent.push({ type: "image_url", image_url: { url } });
    });

    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("La IA devolvió una respuesta vacía.");

    const iaResult = JSON.parse(content);
    return NextResponse.json({ success: true, ...iaResult });

  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    return NextResponse.json({ success: false, error: `La IA de visión falló. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}` }, { status: 500 });
  }
}