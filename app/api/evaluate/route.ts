import { sendEmail } from "@/lib/email";
import { type NextRequest, NextResponse } from "next/server";
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";

// ✅ util para descontar 1 crédito
import { useOneCredit } from "@/lib/credits";

// --- Configuración de APIs ---
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

// --- Biblioteca de Prompts Expertos ---
const promptsExpertos = {
  general: `Actúa como un profesor universitario detallista, riguroso y constructivo. Tu objetivo es ofrecer una retroalimentación que demuestre un análisis profundo y nivel experto del trabajo del estudiante.`,
  matematicas: `Actúa como un catedrático de Matemáticas. Sé riguroso y lógico. Explica el procedimiento correcto paso a paso, citando directamente los errores conceptuales o de cálculo del desarrollo del estudiante.`,
  lenguaje: `Actúa como un crítico literario y académico. Sé profundo y argumentativo. Evalúa la estructura, coherencia y tesis, citando textualmente fragmentos del ensayo para justificar cada punto y revelar el subtexto.`,
  ciencias: `Actúa como un riguroso científico e investigador. Evalúa la aplicación del método científico y la correcta interpretación de datos, citando evidencia específica de los reportes o respuestas para validar o refutar las conclusiones.`,
  artes: `Actúa como un curador de arte y crítico profesional. Tu feedback debe ser conceptual y perceptivo. Describe elementos visuales específicos (ej: 'el trazo fuerte en la esquina', 'el contraste de color') para justificar tu análisis de la composición, técnica e intención artística.`,
  humanidades: `Actúa como un filósofo y académico. Evalúa la profundidad del pensamiento crítico, la claridad de la argumentación y la comprensión de conceptos abstractos, citando las ideas principales del texto del estudiante para realizar un contra-argumento o expandir sobre ellas.`,
  ingles: `Actúa como un examinador de idiomas nivel C2. Evalúa gramática, vocabulario y fluidez, citando ejemplos específicos de errores del texto y ofreciendo la corrección precisa y la razón detrás de ella.`,
};

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
    await new Promise((resolve) => setTimeout(resolve, 1000));
    analysisResult = await client.getReadResult(operationId);
  } while (
    analysisResult.status === "running" ||
    analysisResult.status === "notStarted"
  );
  let fullText = "";
  if (analysisResult.status === "succeeded" && analysisResult.analyzeResult) {
    for (const page of analysisResult.analyzeResult.readResults) {
      for (const line of page.lines) {
        fullText += line.text + "\n";
      }
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

  if (response.status === 401) {
    throw new Error(
      "Error en la API de Mistral: Unauthorized (revisa tu MISTRAL_API_KEY o tu suscripción)"
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Error en la API de Mistral: ${response.status} ${response.statusText} ${text}`
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

    // ✅ Requerimos el email para asociar y controlar créditos
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "Falta userEmail" },
        { status: 400 }
      );
    }

    // ✅ COBRO POR IMAGEN
    const requiredCredits = fileUrls.length;

    // 1) Verificar saldo ANTES de descontar nada (evita cobros parciales)
    try {
      // Construye la URL absoluta hacia tu propio endpoint /api/credits/saldo
      const saldoUrl = new URL("/api/credits/saldo", request.url);
      // 🔧 Cambio clave: muchos endpoints esperan `email`, no `userEmail`
      saldoUrl.searchParams.set("email", userEmail);

      const saldoResp = await fetch(saldoUrl.toString(), { method: "GET" });
      if (!saldoResp.ok) {
        const t = await saldoResp.text().catch(() => "");
        throw new Error(`saldo ${saldoResp.status}: ${t}`);
      }
      const saldoData = await saldoResp.json().catch(() => ({}));
      const saldo = Number(saldoData?.saldo ?? 0);
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
        {
          success: false,
          error: `No se pudo verificar saldo: ${e?.message || e}`,
        },
        { status: 500 }
      );
    }

    // 2) Descontar exactamente requiredCredits (1 por imagen)
    try {
      for (let i = 0; i < requiredCredits; i++) {
        const r = await useOneCredit(userEmail);
        const ok = typeof r === "boolean" ? r : !!(r as any)?.ok;
        if (!ok) {
          const err =
            typeof r === "object" ? (r as any)?.error : "No tienes créditos";
          return NextResponse.json(
            { success: false, error: err },
            { status: 402 }
          );
        }
      }
    } catch (e: any) {
      // Si internamente tu lib usa 'user_email' y tu tabla tiene 'email', este catch atrapará el error:
      return NextResponse.json(
        {
          success: false,
          error:
            e?.message?.includes("user_credits.user_email")
              ? "Error descontando créditos: tu tabla user_credits no tiene la columna 'user_email'. Cámbialo a 'email' en la función useOneCredit."
              : `Error descontando créditos: ${e?.message || e}`,
        },
        { status: 500 }
      );
    }

    // ==== A partir de aquí, tu pipeline original (OCR + LLM) ====
    let textoCompleto = "";
    for (const url of fileUrls) {
      const base64Data = url.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      textoCompleto += (await ocrAzure(buffer)) + "\n\n";
    }

    const personalidadExperto =
      (promptsExpertos as any)[areaConocimiento] || promptsExpertos["general"];

    // ========= PROMPT =========
    const promptFinalParaIA = `
      ${personalidadExperto}

      Tu tarea es realizar un análisis de nivel experto, como si fueras un profesor universitario evaluando un trabajo final. Debes seguir un proceso mental estricto y demostrarlo en tu retroalimentación.

      **PROCESO MENTAL OBLIGATORIO (Piensa paso a paso antes de responder):**
      1.  **Observación Concreta:** Para cada criterio de la RÚBRICA, encuentra el detalle, frase textual o elemento visual más relevante en el trabajo del estudiante.
      2.  **Conexión y Justificación:** Explica CÓMO ese detalle específico que observaste se conecta directamente con el criterio de la rúbrica. No te limites a decir "lo cumple". Justifica tu evaluación.
      3.  **Interpretación Profunda:** Ofrece una interpretación de lo que esa evidencia significa. ¿Qué demuestra sobre el nivel de habilidad o comprensión del estudiante? ¿Qué implicaciones tiene?
      4.  **Síntesis del Feedback:** Construye tu retroalimentación usando los resultados de los pasos anteriores. La clave "detalle" debe explicar tu justificación (Paso 2 y 3), y la clave "evidencia" DEBE contener la observación concreta y específica (Paso 1).

      **FORMATO DE SALIDA (JSON VÁLIDO Y ESTRICTO):**
      {
        "puntaje": "string",
        "nota": number,
        "retroalimentacion": {
          "correccion_detallada": [{ "seccion": "string", "detalle": "string" }],
          "evaluacion_habilidades": [{ "habilidad": "string", "evaluacion": "string", "evidencia": "string" }],
          "resumen_general": { "fortalezas": "string", "areas_mejora": "string" }
        }
      }

      **INSUMOS:**
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

    // --- GUARDIA DE CALIDAD ---
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

    // ✅ Envío de correo (no corta el flujo si falla)
    try {
      await sendEmail({
        from: process.env.RESEND_FROM || "Libel-IA <onboarding@resend.dev>",
        to: userEmail,
        subject: "Resultado de evaluación — Libel-IA",
        text: `Tu evaluación está lista.\n\nPuntaje: ${resultado.puntaje || "N/A"}\nNota: ${
          resultado.nota ?? "N/A"
        }\n\nGracias por usar Libel-IA.`,
        html: `
          <h2>¡Tu evaluación está lista!</h2>
          <p><b>Puntaje:</b> ${resultado.puntaje || "N/A"}</p>
          <p><b>Nota:</b> ${resultado.nota ?? "N/A"}</p>
          <p>${
            (resultado?.retroalimentacion?.resumen_general?.fortalezas ||
              "Resumen no disponible")
              .toString()
              .slice(0, 240)
          }...</p>
          <hr/>
          <p style="font-size:12px;color:#555">Gracias por usar <b>Libel-IA</b>.</p>
        `,
      });
    } catch (e: any) {
      console.error(
        "⚠️ Aviso: el envío de email falló (no se interrumpe la evaluación):",
        e?.message || e
      );
    }

    return NextResponse.json({ success: true, ...resultado });
  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
