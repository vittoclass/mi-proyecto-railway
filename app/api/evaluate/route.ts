// app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { sendEmail } from "@/lib/email";

// ⬇️ usa el supabase admin directo (sin fetch interno)
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ✅ runtime node (NO edge)
export const runtime = "nodejs";

// --- Configuración de APIs ---
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

// --- Biblioteca de Prompts Expertos ---
const promptsExpertos = {
  general: `Actúa como un profesor universitario detallista, riguroso y constructivo. Tu objetivo es ofrecer una retroalimentación que demuestre un análisis profundo y nivel experto del trabajo del estudiante.`,
  matematicas: `Actúa como un catedrático de Matemáticas...`,
  lenguaje: `Actúa como un crítico literario y académico...`,
  ciencias: `Actúa como un riguroso científico e investigador...`,
  artes: `Actúa como un curador de arte y crítico profesional...`,
  humanidades: `Actúa como un filósofo y académico...`,
  ingles: `Actúa como un examinador de idiomas nivel C2...`,
};

// --- Helpers créditos (versión simple: una fila por usuario con columna `credits`) ---
async function getSaldo(email: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("user_credits")
    .select("credits")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`Supabase saldo: ${error.message}`);
  return Number(data?.credits ?? 0);
}

async function useOneCredit(email: string): Promise<boolean> {
  // Lee saldo actual
  const { data: row, error } = await supabaseAdmin
    .from("user_credits")
    .select("id, credits")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`Supabase read: ${error.message}`);
  const credits = Number(row?.credits ?? 0);
  if (!row || credits <= 0) return false;

  const { error: updErr } = await supabaseAdmin
    .from("user_credits")
    .update({ credits: credits - 1 })
    .eq("id", row.id);

  if (updErr) throw new Error(`Supabase update: ${updErr.message}`);
  return true;
}

// --- Funciones de Soporte ---
async function ocrAzure(imageBuffer: Buffer): Promise<string> {
  const credentials = new ApiKeyCredentials({
    inHeader: { "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY },
  });
  const client = new ComputerVisionClient(credentials, AZURE_VISION_ENDPOINT);
  const result = await client.readInStream(imageBuffer);
  const operationId = result.operationLocation.split("/").pop()!;
  let analysisResult;
  do {
    await new Promise((r) => setTimeout(r, 1000));
    analysisResult = await client.getReadResult(operationId);
  } while (
    analysisResult.status === "running" ||
    analysisResult.status === "notStarted"
  );

  let fullText = "";
  if (analysisResult.status === "succeeded" && analysisResult.analyzeResult) {
    for (const page of analysisResult.analyzeResult.readResults) {
      for (const line of page.lines) fullText += line.text + "\n";
    }
  }
  return fullText;
}

async function callMistralAPI(payload: any) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Error en la API de Mistral: ${response.status} ${response.statusText} ${body}`
    );
  }
  return response.json();
}

// --- API Principal de Evaluación ---
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { fileUrls, rubrica, pauta, areaConocimiento, userEmail } = payload;

    if (!fileUrls || fileUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron archivos." },
        { status: 400 }
      );
    }
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "Falta userEmail" },
        { status: 400 }
      );
    }

    const requiredCredits = fileUrls.length;

    // 1) Verificar saldo DIRECTO (sin fetch a /api/credits/saldo)
    let saldo = 0;
    try {
      saldo = await getSaldo(userEmail);
      if (!Number.isFinite(saldo) || saldo < requiredCredits) {
        return NextResponse.json(
          {
            success: false,
            error: `Saldo insuficiente: necesitas ${requiredCredits}, disponible ${saldo}`,
          },
          { status: 402 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `No se pudo verificar saldo: ${e?.message || e}` },
        { status: 500 }
      );
    }

    // 2) Descontar N créditos (uno por imagen)
    try {
      for (let i = 0; i < requiredCredits; i++) {
        const ok = await useOneCredit(userEmail);
        if (!ok) {
          return NextResponse.json(
            { success: false, error: "No tienes créditos disponibles" },
            { status: 402 }
          );
        }
      }
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `Error descontando créditos: ${e?.message || e}` },
        { status: 500 }
      );
    }

    // ==== OCR de todas las imágenes ====
    let textoCompleto = "";
    for (const url of fileUrls) {
      const base64Data = url.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      textoCompleto += (await ocrAzure(buffer)) + "\n\n";
    }

    const personalidad = promptsExpertos[areaConocimiento] || promptsExpertos.general;

    const promptFinalParaIA = `
      ${personalidad}
      Tu tarea es realizar un análisis de nivel experto...
      (tu prompt largo intacto)
      TEXTO DEL ESTUDIANTE: """${textoCompleto}"""
      RÚBRICA: """${rubrica}"""
      PAUTA (si aplica): """${pauta}"""
    `;

    const aiResponse = await callMistralAPI({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: promptFinalParaIA }],
      response_format: { type: "json_object" },
    });

    const content = aiResponse.choices[0].message.content;
    let resultado = JSON.parse(content);

    // Guardia de calidad
    let notaNumerica = parseFloat(resultado.nota);
    if (isNaN(notaNumerica) || notaNumerica < 1.0) notaNumerica = 1.0;
    else if (notaNumerica > 7.0) notaNumerica = 7.0;
    resultado.nota = notaNumerica;

    resultado.puntaje = String(resultado.puntaje || "N/A");
    resultado.retroalimentacion = resultado.retroalimentacion || {};
    if (!Array.isArray(resultado.retroalimentacion.correccion_detallada))
      resultado.retroalimentacion.correccion_detallada = [];
    if (!Array.isArray(resultado.retroalimentacion.evaluacion_habilidades))
      resultado.retroalimentacion.evaluacion_habilidades = [];
    resultado.retroalimentacion.resumen_general =
      resultado.retroalimentacion.resumen_general || {
        fortalezas: "No especificado.",
        areas_mejora: "No especificado.",
      };

    // Email (no rompe si falla)
    try {
      await sendEmail({
        from: process.env.RESEND_FROM || "Libel-IA <onboarding@resend.dev>",
        to: userEmail,
        subject: "Resultado de evaluación — Libel-IA",
        text: `Puntaje: ${resultado.puntaje}\nNota: ${resultado.nota}`,
        html: `<h2>¡Tu evaluación está lista!</h2>
               <p><b>Puntaje:</b> ${resultado.puntaje}</p>
               <p><b>Nota:</b> ${resultado.nota}</p>`,
      });
    } catch (e) {
      console.warn("Email falló (no crítico)", e);
    }

    return NextResponse.json({ success: true, ...resultado });
  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
