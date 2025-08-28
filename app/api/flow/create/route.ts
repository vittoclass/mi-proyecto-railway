import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ENV
const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const FLOW_ENV = (process.env.FLOW_ENV || "sandbox").toLowerCase();

const FLOW_HOST = FLOW_ENV === "prod" ? "https://www.flow.cl" : "https://sandbox.flow.cl";
const FLOW_CREATE_URL = `${FLOW_HOST}/api/payment/create`;

const PLAN_CREDITS: Record<string, number> = {
  basic: 90,
  intermediate: 640,
  pro: 1280,
};

// firma sobre string codificado (k=v con encodeURIComponent)
async function signEncoded(params: Record<string,string>, secret: string) {
  const { createHmac } = await import("crypto");
  const entries = Object.entries(params).sort(([a],[b]) => a.localeCompare(b));
  const bodyStr = entries.map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const s = createHmac("sha256", secret).update(bodyStr).digest("hex");
  return { s, bodyStr, mode: "encoded" as const };
}

// firma sobre string sin codificar (k=v sin encodeURIComponent)
async function signRaw(params: Record<string,string>, secret: string) {
  const { createHmac } = await import("crypto");
  const entries = Object.entries(params).sort(([a],[b]) => a.localeCompare(b));
  const bodyStr = entries.map(([k,v]) => `${k}=${v}`).join("&");
  const s = createHmac("sha256", secret).update(bodyStr).digest("hex");
  return { s, bodyStr, mode: "raw" as const };
}

async function callFlowCreate(body: string) {
  const resp = await fetch(FLOW_CREATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body,
  });
  const text = await resp.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* OK, queda text */ }
  return { ok: resp.ok, status: resp.status, data, text };
}

export async function POST(req: Request) {
  try {
    const { userEmail, planId, precioCLP } = await req.json();

    if (!userEmail || !planId || !precioCLP) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
      return NextResponse.json({ error: "Faltan credenciales de Flow" }, { status: 500 });
    }
    if (!PLAN_CREDITS[planId]) {
      return NextResponse.json({ error: "Plan inválido para Flow" }, { status: 400 });
    }

    const email = String(userEmail).toLowerCase();
    const commerceOrder = Date.now().toString();
    const subject = `Libel-IA — ${planId}`;
    const currency = "CLP";
    const amount = Number(precioCLP);

    const urlReturn = `${BASE_URL}/pagos/success?plan=${encodeURIComponent(planId)}`;
    const urlConfirmation = `${BASE_URL}/api/flow/webhook`;

    // Params + metadatos (planId) que nos devuelve Flow en webhook
    const baseParams: Record<string,string> = {
      amount: String(amount),
      apiKey: FLOW_API_KEY,
      commerceOrder,
      currency,
      email,
      subject,
      urlConfirmation,
      urlReturn,
      planId, // custom
    };

    // 1) Intento con firma "encoded"
    const enc = await signEncoded(baseParams, FLOW_SECRET_KEY);
    const attempt1Body = `${enc.bodyStr}&s=${encodeURIComponent(enc.s)}`;
    const r1 = await callFlowCreate(attempt1Body);
    if (r1.ok && r1.data?.url) {
      return NextResponse.json({ url: r1.data.url });
    }

    // 2) Si falla, intento con firma "raw"
    const raw = await signRaw(baseParams, FLOW_SECRET_KEY);
    const attempt2Body = `${raw.bodyStr}&s=${raw.s}`;
    const r2 = await callFlowCreate(attempt2Body);
    if (r2.ok && r2.data?.url) {
      return NextResponse.json({ url: r2.data.url, note: "signed_raw_ok" });
    }

    // Si igualmente falla, devuelvo TODO el debug para que lo veamos altiro
    return NextResponse.json({
      error: "Error al crear pago en Flow",
      detalle: {
        host: FLOW_HOST,
        env: FLOW_ENV,
        baseParams,
        attempt1: { mode: enc.mode, status: r1.status, data: r1.data ?? r1.text?.slice(0,500) },
        attempt2: { mode: raw.mode, status: r2.status, data: r2.data ?? r2.text?.slice(0,500) }
      }
    }, { status: 502 });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado en Flow" }, { status: 500 });
  }
}
