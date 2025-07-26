import { type NextRequest, NextResponse } from "next/server";

// ... (La función callOpenAIVisionAPI se mantiene igual)

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, rubrica } = await request.json();

    if (!imageUrls || imageUrls.length === 0 || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos." }, { status: 400 });
    }

    const imageContent = imageUrls.map((url: string) => ({
      type: "image_url",
      image_url: { "url": url },
    }));

    const prompt = `
      Evalúa el conjunto de ${imageUrls.length} imágenes adjuntas basándote en la rúbrica.
      - RÚBRICA: """${rubrica}"""
      - FORMATO DE RESPUESTA JSON OBLIGATORIO:
      {
        "retroalimentacion": "Un feedback detallado y constructivo.",
        "puntaje": "El puntaje obtenido en formato 'X/Y'.",
        "nota": "La calificación final calculada en una escala de 1.0 a 7.0, basada en un 60% de exigencia."
      }
    `;

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
    console.error("Evaluation error:", error);
    return NextResponse.json({ success: false, error: `La IA de visión falló. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}` }, { status: 500 });
  }
}