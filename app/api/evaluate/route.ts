// En: app/api/evaluate/route.ts (NUEVA ARQUITECTURA JSON)

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

// --- FUNCIONES HELPER (LAS MISMAS DE ANTES) ---
async function callOpenAIVisionAPI(payload: any) { /* ...código sin cambios... */ }

// --- FUNCIÓN PRINCIPAL POST (AHORA RECIBE JSON) ---
export async function POST(request: NextRequest) {
  try {
    const { fileUrl, rubrica, flexibilidad } = await request.json(); // Leemos un JSON

    if (!fileUrl || !rubrica) {
      return NextResponse.json({ success: false, error: "Faltan datos (URL del archivo o rúbrica)." }, { status: 400 });
    }

    // El resto de la lógica es muy similar, pero usamos la URL
    // En un caso real y más seguro, descargaríamos el archivo desde la URL aquí.
    // Por simplicidad para la IA de visión, le pasamos la URL directamente.

    const prompt = `
      Eres un profesor experto evaluando un trabajo. La evidencia está en la siguiente URL.
      - URL DE LA IMAGEN: ${fileUrl}
      - RÚBRICA: """${rubrica}"""
      - FLEXIBILIDAD (1=estricto, 5=benevolente): ${flexibilidad}
      - FORMATO DE RESPUESTA JSON OBLIGATORIO: { "retroalimentacion": "...", "puntaje": "...", "nota": X.X }
    `;

    const data = await callOpenAIVisionAPI({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { "url": fileUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("La IA devolvió una respuesta vacía.");

    const iaResult = JSON.parse(content);
    return NextResponse.json({ success: true, ...iaResult });

  } catch (error) {
    console.error("Evaluation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: `La IA de visión falló. Detalle: ${errorMessage}` }, { status: 500 });
  }
}