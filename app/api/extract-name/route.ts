import { type NextRequest, NextResponse } from "next/server";

// ... (Las funciones callMistralAPI y ocrAzure se mantienen igual)

async function extractNameWithAI(text: string) {
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
  const result = JSON.parse(content);
  return result.sugerencias || [];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) return NextResponse.json({ success: false, error: "No files provided" });

    let combinedText = "";
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      combinedText += await ocrAzure(buffer) + "\n\n";
    }

    const suggestions = await extractNameWithAI(combinedText);

    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("Name extraction error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}