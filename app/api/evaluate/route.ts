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
  const credentials = new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY } });
  const client = new ComputerVisionClient(credentials, AZURE_VISION_ENDPOINT);
  const result = await client.readInStream(imageBuffer);
  const operationId = result.operationLocation.split("/").pop()!;
  let analysisResult;
  do {
    await new Promise(resolve => setTimeout(resolve, 1000));
    analysisResult = await client.getReadResult(operationId);
  } while (analysisResult.status === "running" || analysisResult.status === "notStarted");
  let fullText = "";
  if (analysisResult.status === "succeeded" && analysisResult.analyzeResult) {
    for (const page of analysisResult.analyzeResult.readResults) {
      for (const line of page.lines) { fullText += line.text + "\n"; }
    }
  }
  return fullText;
}

async function callMistralAPI(payload: any) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) { throw new Error(`Error en la API de Mistral: ${response.statusText}`); }
  return response.json();
}

// --- API Principal de Evaluación ---
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { fileUrls, rubrica, pauta, areaConocimiento, userEmail } = payload;

    if (!fileUrls || fileUrls.length === 0) {
      return NextResponse.json({ success: false, error: "No se proporcionaron archivos." }, { status: 400 });
    }

    // ✅ Requerimos el email para asociar y controlar créditos
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Falta userEmail" }, { status: 400 });
    }

    // ✅ COBRO POR IMAGEN
    const requiredCredits = fileUrls.length;

    // 1) Verificar saldo ANTES de descontar nada (evita cobros parciales)
    try {
      // Construye la URL absoluta hacia tu propio endpoint /api/credits/saldo
      const saldoUrl = new URL("/api/credits/saldo", request.url);
      saldoUrl.searchParams.set("userEmail", userEmail);
      const saldoResp = await fetch(saldoUrl.toString(), { method: "GET" });
      const saldoData = await saldoResp.json().catch(() => ({}));
      const saldo = Number(saldoData?.saldo ?? 0);
      if (!Number.isFinite(saldo) || saldo < requiredCredits) {
        return NextResponse.json(
          { success: false, error: `Saldo insuficiente: necesitas ${requiredCredits}, disponible ${saldo}` },
          { status: 402 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `No se pudo verificar saldo: ${e?.message || e}` },
        { status: 500 }
      );
    }

    // 2) Descontar exactamente requiredCredits (1 por imagen)
    try {
      for (let i = 0; i < requiredCredits; i++) {
        const r = await useOneCredit(userEmail);
        const ok = typeof r === "boolean" ? r : !!(r as any)?.ok;
        if (!ok) {
          const err = typeof r === "object" ? (r as any)?.error : undefined;
          return NextResponse.json(
            { success: false, error: err || "No tienes créditos disponibles" },
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

    // ==== A partir de aquí, tu pipeline original (OCR + LLM) ====
    let textoCompleto = "";
    for (const url of fileUrls) {
      const base64Data = url.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      textoCompleto += await ocrAzure(buffer) + "\n\n";
    }

    const personalidadExperto = promptsExpertos[areaConocimiento] || promptsExpertos["general"];

    // ========= INICIO: PROMPT FINAL DE CALIDAD SUPERIOR =========
    const promptFinalParaIA = `
      ${personalidadExperto}

      Tu tarea es realizar un análisis de nivel experto, como si fueras un profesor universitario evaluando un trabajo final. Debes seguir un proceso mental estricto y demostrarlo en tu retroalimentación.

      **PROCESO MENTAL OBLIGATORIO (Piensa paso a paso antes de responder):**
      1.  **Observación Concreta:** Para cada criterio de la RÚBRICA, encuentra el detalle, frase textual o elemento visual más relevante en el trabajo del estudiante.
      2.  **Conexión y Justificación:** Explica CÓMO ese detalle específico que observaste se conecta directamente con el criterio de la rúbrica. No te limites a decir "lo cumple". Justifica tu evaluación.
      3.  **Interpretación Profunda:** Ofrece una interpretación de lo que esa evidencia significa. ¿Qué demuestra sobre el nivel de habilidad o comprensión del estudiante? ¿Qué implicaciones tiene?
      4.  **Síntesis del Feedback:** Construye tu retroalimentación usando los resultados de los pasos anteriores. La clave "detalle" debe explicar tu justificación (Paso 2 y 3), y la clave "evidencia" DEBE contener la observación concreta y específica (Paso 1).

      **EJEMPLO PERFECTO DE TU TRABAJO (Este es tu estándar de calidad):**
      * **RÚBRICA dice:** "Crítica Social: La ilustración aborda de manera clara y crítica un tema relevante de la sociedad."
      * **TU PROCESO MENTAL:**
          1.  *Observación:* "Veo un cráneo humano pintado de negro. La cara no tiene boca y los ojos son barrotes de una celda."
          2.  *Conexión:* "Los barrotes son un símbolo universal de 'prisión' y 'falta de libertad', lo que conecta directamente con la idea de una 'crítica social'."
          3.  *Interpretación:* "El uso del cráneo sugiere que esta es una condición humana fundamental, no temporal. Podría interpretarse como una crítica a cómo nuestras propias mentes, o la sociedad misma, nos aprisionan de forma predeterminada, limitando nuestra perspectiva."
      * **TU SALIDA JSON (para ese criterio):**
          "habilidad": "Crítica Social",
          "evaluacion": "Excelente",
          "evidencia": "La cara del cráneo está representada por barrotes de celda."
          // El detalle en "correccion_detallada" incluiría la interpretación completa.

      **FORMATO DE SALIDA (JSON VÁLIDO Y ESTRICTO):**
      {
        "puntaje": "string (ej: '40/42' o 'Sobresaliente')",
        "nota": number (decimal entre 1.0 y 7.0, ajustado a la realidad de la evaluación),
        "retroalimentacion": {
          "correccion_detallada": [{ "seccion": "string", "detalle": "string (tu justificación e interpretación profunda aquí)" }],
          "evaluacion_habilidades": [{ "habilidad": "string (criterio de la rúbrica)", "evaluacion": "string (ej: Logrado)", "evidencia": "string (la cita textual o descripción visual específica)" }],
          "resumen_general": { "fortalezas": "string", "areas_mejora": "string" }
        }
      }

      **INSUMOS PARA TU EVALUACIÓN:**
      TEXTO DEL ESTUDIANTE: """${textoCompleto}"""
      RÚBRICA: """${rubrica}"""
      PAUTA (si aplica): """${pauta}"""
    `;
    // ========= FIN: PROMPT FINAL DE CALIDAD SUPERIOR =========

    const aiResponse = await callMistralAPI({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: promptFinalParaIA }],
      response_format: { type: "json_object" },
    });

    const content = aiResponse.choices[0].message.content;
    let resultado = JSON.parse(content);

    // --- GUARDIA DE CALIDAD Y REPARACIÓN DE DATOS (VERSIÓN FINAL) ---
    console.log("Respuesta de la IA antes de corregir:", resultado);

    let notaNumerica = parseFloat(resultado.nota);
    if (isNaN(notaNumerica) || notaNumerica < 1.0) notaNumerica = 1.0;
    else if (notaNumerica > 7.0) notaNumerica = 7.0;
    resultado.nota = notaNumerica;

    resultado.puntaje = String(resultado.puntaje || "N/A");

    resultado.retroalimentacion = resultado.retroalimentacion || {};
    if (!Array.isArray(resultado.retroalimentacion.correccion_detallada)) resultado.retroalimentacion.correccion_detallada = [];
    if (!Array.isArray(resultado.retroalimentacion.evaluacion_habilidades)) resultado.retroalimentacion.evaluacion_habilidades = [];
    resultado.retroalimentacion.resumen_general = resultado.retroalimentacion.resumen_general || { fortalezas: "No especificado.", areas_mejora: "No especificado." };

    console.log("Respuesta corregida y enviada al frontend:", resultado);

    // ✅ Envío de correo (no afecta si falla)
    try {
      await sendEmail({
        to: userEmail,
        subject: "Resultado de evaluación — Libel-IA",
        html: `
          <h2>¡Tu evaluación está lista!</h2>
          <p><b>Puntaje:</b> ${resultado.puntaje || "N/A"}</p>
          <p><b>Nota:</b> ${resultado.nota ?? "N/A"}</p>
          <p>${(resultado?.retroalimentacion?.resumen_general?.fortalezas || "Resumen no disponible")
            .toString().slice(0, 240)}...</p>
          <p>Gracias por usar Libel-IA.</p>
        `,
      });
    } catch (e) {
      console.error("Aviso: email falló (no se interrumpe la evaluación):", e);
    }

    return NextResponse.json({ success: true, ...resultado });

  } catch (error) {
    console.error("Error en /api/evaluate:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
