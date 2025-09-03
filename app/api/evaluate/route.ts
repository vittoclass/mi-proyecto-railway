// app/api/evaluate/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { ApiKeyCredentials } from '@azure/ms-rest-js';
import { sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ✅ runtime node (NO edge)
export const runtime = 'nodejs';

// --- Configuración de APIs ---
const AZURE_VISION_ENDPOINT = process.env.AZURE_VISION_ENDPOINT!;
const AZURE_VISION_KEY = process.env.AZURE_VISION_KEY!;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

// --- Biblioteca de Prompts Expertos ---
const promptsExpertos: Record<string, string> = {
  general: `Actúa como un profesor universitario detallista, riguroso y constructivo. Tu objetivo es ofrecer una retroalimentación que demuestre un análisis profundo y nivel experto del trabajo del estudiante.`,
  matematicas: `Actúa como un catedrático de Matemáticas que evalúa procedimientos, justificación y resultados con precisión.`,
  lenguaje: `Actúa como un crítico literario y académico que evalúa comprensión lectora, análisis, cohesión, coherencia y recursos de redacción.`,
  ciencias: `Actúa como un riguroso científico e investigador que evalúa precisión conceptual, método y explicación de procesos.`,
  artes: `Actúa como un curador de arte y crítico profesional que evalúa composición, técnica y argumentación estética.`,
  humanidades: `Actúa como un filósofo y académico que evalúa argumentación, fuentes y claridad conceptual.`,
  ingles: `Actúa como un examinador de idiomas nivel C2 que evalúa comprensión, gramática, vocabulario y cohesión.`,
};

// --- Helpers créditos (una fila por usuario con columna `credits`) ---
async function getSaldo(email: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Supabase saldo: ${error.message}`);
  return Number(data?.credits ?? 0);
}

async function useOneCredit(email: string): Promise<boolean> {
  const { data: row, error } = await supabaseAdmin
    .from('user_credits')
    .select('id, credits')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Supabase read: ${error.message}`);
  const credits = Number(row?.credits ?? 0);
  if (!row || credits <= 0) return false;

  const { error: updErr } = await supabaseAdmin
    .from('user_credits')
    .update({ credits: credits - 1 })
    .eq('id', row.id);
  if (updErr) throw new Error(`Supabase update: ${updErr.message}`);
  return true;
}

// --- Soporte OCR Azure ---
async function ocrAzure(imageBuffer: Buffer): Promise<string> {
  const credentials = new ApiKeyCredentials({
    inHeader: { 'Ocp-Apim-Subscription-Key': AZURE_VISION_KEY },
  });
  const client = new ComputerVisionClient(credentials, AZURE_VISION_ENDPOINT);
  const result = await client.readInStream(imageBuffer);
  const operationId = result.operationLocation!.split('/').pop()!;
  let analysisResult: any;
  do {
    await new Promise((r) => setTimeout(r, 1000));
    analysisResult = await client.getReadResult(operationId);
  } while (analysisResult.status === 'running' || analysisResult.status === 'notStarted');

  let fullText = '';
  if (analysisResult.status === 'succeeded' && analysisResult.analyzeResult) {
    for (const page of analysisResult.analyzeResult.readResults) {
      for (const line of page.lines) fullText += line.text + '\n';
    }
  }
  return fullText;
}

// --- Mistral ---
async function callMistralAPI(payload: any) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Error en la API de Mistral: ${response.status} ${response.statusText} ${body}`);
  }
  return response.json();
}

// --- Utilidades de forma segura ---
const asArray = (v: any) => (Array.isArray(v) ? v : []);
const asResumen = (v: any) =>
  v && typeof v === 'object'
    ? { fortalezas: v.fortalezas ?? '', areas_mejora: v.areas_mejora ?? '' }
    : { fortalezas: '', areas_mejora: '' };

function computeFromPuntaje(puntajeStr?: string) {
  const m = String(puntajeStr || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const aciertos = parseInt(m[1], 10);
  const total = parseInt(m[2], 10);
  if (!total) return null;
  const ratio = Math.max(0, Math.min(1, aciertos / total));
  let nota = 1 + 6 * ratio; // escala 1.0–7.0
  nota = Math.round(nota * 10) / 10;
  const decimas = Math.max(0, Math.min(9, Math.round((nota - Math.floor(nota)) * 10)));
  return { aciertos, total, nota, decimas };
}

// Normalización de niveles aceptados para habilidades
function normalizeLevel(v: any): 'Logrado' | 'Parcialmente logrado' | 'En desarrollo' | 'No logrado' {
  const s = String(v || '').toLowerCase();
  if (/logrado|avanzado|alto|excelente/.test(s)) return 'Logrado';
  if (/parcial|medio|intermedio|aceptable/.test(s)) return 'Parcialmente logrado';
  if (/desarrollo|b[aá]sico|incipiente/.test(s)) return 'En desarrollo';
  return 'No logrado';
}

// --- API Principal ---
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { fileUrls, rubrica, pauta, areaConocimiento, userEmail } = payload;

    if (!fileUrls || fileUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'No se proporcionaron archivos.' }, { status: 400 });
    }
    if (!userEmail) {
      return NextResponse.json({ success: false, error: 'Falta userEmail' }, { status: 400 });
    }

    const requiredCredits = fileUrls.length;

    // 1) Verificar saldo
    let saldo = 0;
    try {
      saldo = await getSaldo(userEmail);
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

    // 2) Descontar N créditos
    try {
      for (let i = 0; i < requiredCredits; i++) {
        const ok = await useOneCredit(userEmail);
        if (!ok) {
          return NextResponse.json({ success: false, error: 'No tienes créditos disponibles' }, { status: 402 });
        }
      }
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `Error descontando créditos: ${e?.message || e}` },
        { status: 500 }
      );
    }

    // 3) OCR de todas las imágenes
    let textoCompleto = '';
    for (const url of fileUrls) {
      const base64Data = String(url).includes(',') ? String(url).split(',')[1] : url;
      const buffer = Buffer.from(base64Data, 'base64');
      textoCompleto += (await ocrAzure(buffer)) + '\n\n';
    }

    const personalidad = promptsExpertos[areaConocimiento] || promptsExpertos.general;

    // 4) Prompt con contrato ESTRICTO basado en RÚBRICA (sin copiarla literal)
    const promptFinalParaIA = `
${personalidad}

Evalúa el TEXTO DEL ESTUDIANTE utilizando EXCLUSIVAMENTE la RÚBRICA proporcionada. 
Devuelve SOLO un JSON con este esquema EXACTO (sin texto adicional fuera del JSON):

{
  "puntaje": "string | N/A",
  "nota": number, 
  "retroalimentacion": {
    "correccion_detallada": [
      { "seccion": "string", "detalle": "string" }
    ],
    "evaluacion_habilidades": [
      { "habilidad": "string", "evaluacion": "Logrado | Parcialmente logrado | En desarrollo | No logrado", "evidencia": "string" }
    ],
    "resumen_general": { "fortalezas": "string", "areas_mejora": "string" },
    "retroalimentacion_alternativas": []
  }
}

REGLAS IMPORTANTES:
- "correccion_detallada": crea 4–8 entradas, **una por criterio/pregunta de la rúbrica**. 
  *NO* pegues la rúbrica literal. Resume cada criterio en 2–4 oraciones con recomendaciones específicas.
- "evaluacion_habilidades": genera 5–8 habilidades **derivadas de la rúbrica/preguntas** (no genéricas), con "evaluacion" en 
  {Logrado, Parcialmente logrado, En desarrollo, No logrado}. Usa evidencia breve del texto cuando exista; si no, di "No hay evidencia clara".
- "nota": si no puedes calcularla, deja 1.0. 
- Responde SIEMPRE en español. 
- NO uses markdown ni backticks. 
- NO agregues campos distintos a los del esquema.

TEXTO DEL ESTUDIANTE:
"""${textoCompleto}"""

RÚBRICA:
"""${rubrica ?? ''}"""

PAUTA (si aplica):
"""${pauta ?? ''}"""
`;

    const aiResponse = await callMistralAPI({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: promptFinalParaIA }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    // 5) Parse robusto
    const content = aiResponse?.choices?.[0]?.message?.content;
    const rawStr = typeof content === 'string' ? content : JSON.stringify(content ?? '{}');
    let resultado: any = {};
    try {
      resultado = JSON.parse(rawStr);
    } catch {
      resultado = {};
    }

    // 6) Normalización/Coerción SEGURA
    let notaNumerica = parseFloat(resultado?.nota);
    if (!Number.isFinite(notaNumerica)) notaNumerica = 1.0;
    if (notaNumerica < 1.0) notaNumerica = 1.0;
    if (notaNumerica > 7.0) notaNumerica = 7.0;

    const retro = resultado?.retroalimentacion ?? {};
    const normalizado: any = {
      puntaje: String(resultado?.puntaje ?? 'N/A'),
      nota: notaNumerica,
      retroalimentacion: {
        correccion_detallada: asArray(retro.correccion_detallada),
        evaluacion_habilidades: asArray(retro.evaluacion_habilidades),
        resumen_general: asResumen(retro.resumen_general),
        retroalimentacion_alternativas: asArray(retro.retroalimentacion_alternativas),
      },
    };

    // 7) Normalización de estructuras (sin modificar formato del PDF/cliente)
    // 7.a) correccion_detallada -> siempre objetos {seccion, detalle} y sin copiar rubrica literal
    normalizado.retroalimentacion.correccion_detallada =
      (normalizado.retroalimentacion.correccion_detallada || []).map((it: any, idx: number) => {
        if (typeof it === 'string') {
          return { seccion: idx === 0 ? 'General' : `Criterio ${idx + 1}`, detalle: it };
        }
        return {
          seccion: String(it?.seccion ?? it?.Seccion ?? it?.section ?? `Criterio ${idx + 1}`),
          detalle: String(it?.detalle ?? it?.Detalle ?? it?.detail ?? ''),
        };
      }).filter((x: any) => x.detalle && x.detalle.trim().length > 0);

    if (!normalizado.retroalimentacion.correccion_detallada.length) {
      normalizado.retroalimentacion.correccion_detallada = [
        { seccion: 'General', detalle: 'Ajusta el trabajo a los criterios de la rúbrica con observaciones concretas y ejemplos del texto.' },
      ];
    }

    // 7.b) evaluacion_habilidades -> {habilidad, evaluacion, evidencia} y niveles normalizados
    normalizado.retroalimentacion.evaluacion_habilidades =
      (normalizado.retroalimentacion.evaluacion_habilidades || []).map((it: any) => {
        const habilidad = String(it?.habilidad ?? it?.skill ?? it?.competencia ?? '').trim() || 'Criterio de la rúbrica';
        const evaluacion = normalizeLevel(it?.evaluacion ?? it?.nivel ?? it?.level);
        const evidencia = String(it?.evidencia ?? '').trim() || 'No hay evidencia clara.';
        return { habilidad, evaluacion, evidencia };
      });

    // 7.c) Fortalezas/Áreas si faltan
    if (!normalizado.retroalimentacion.resumen_general.fortalezas) {
      normalizado.retroalimentacion.resumen_general.fortalezas =
        'Se observan avances alineados parcialmente con los criterios de la rúbrica.';
    }
    if (!normalizado.retroalimentacion.resumen_general.areas_mejora) {
      normalizado.retroalimentacion.resumen_general.areas_mejora =
        'Profundizar en los criterios de la rúbrica y mejorar precisión, organización y redacción.';
    }

    // 7.d) Nota y décimas desde puntaje si aplica
    const calc = computeFromPuntaje(normalizado.puntaje);
    if (calc && !(normalizado.nota >= 1 && normalizado.nota <= 7)) {
      normalizado.nota = calc.nota;
      normalizado.decimas = calc.decimas;
    }

    // 8) Email (no crítico)
    try {
      await sendEmail({
        from: process.env.RESEND_FROM || 'Libel-IA <onboarding@resend.dev>',
        to: userEmail,
        subject: 'Resultado de evaluación — Libel-IA',
        text: `Puntaje: ${normalizado.puntaje}\nNota: ${normalizado.nota}`,
        html: `<h2>¡Tu evaluación está lista!</h2>
               <p><b>Puntaje:</b> ${normalizado.puntaje}</p>
               <p><b>Nota:</b> ${normalizado.nota}</p>`,
      });
    } catch (e) {
      console.warn('Email falló (no crítico)', e);
    }

    // 9) Respuesta final estable para tu UI/PDF
    return NextResponse.json({ success: true, ...normalizado });
  } catch (error: any) {
    console.error('Error en /api/evaluate:', error);
    const msg = error?.message || 'Error desconocido';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}