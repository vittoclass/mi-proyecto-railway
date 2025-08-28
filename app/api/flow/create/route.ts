// app/api/flow/create/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ENV
const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const FLOW_ENV = (process.env.FLOW_ENV || "sandbox").toLowerCase(); // "sandbox" | "prod"

// ENDPOINT según ambiente
const FLOW_HOST =
  FLOW_ENV === "prod" ? "https://www.flow.cl" : "https://sandbox.flow.cl";
const FLOW_CREATE_URL = `${FLOW_HOST}/api/payment/create`;

// Créditos por plan (asegúrate de que coincidan con tu UI)
const PLAN_CREDITS: Record<string, number> = {
  basic: 90,           // Khipu normalmente, pero lo dejo mapeado
  intermediate: 640,   // Flow
  pro: 1280,           // Flow
};

// Flow firma HMAC-SHA256 sobre los pares ordenados alfabéticamente,
// con el MISMO string que se envía (application/x-www-form-urlencoded).
async function signFlow(params: Record<string, string>, secret: string) {
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  // construimos exactamente "k1=v1&k2=v2..." con encodeURIComponent como hará el body
  const bodyStr = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const { createHmac } = await import("crypto");
  const h = createHmac("sha256", secret);
  h.update(bodyStr);
  const s = h.digest("hex");
  return { s, bodyStr };
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
    const commerceOrder = Date.now().toString(); // único por pago
    const subject = `Libel-IA — ${planId}`;
    const currency = "CLP";
    const amount = Number(precioCLP);

    const urlReturn = `${BASE_URL}/pagos/success?plan=${encodeURIComponent(planId)}`;
    const urlConfirmation = `${BASE_URL}/api/flow/webhook`;

    // Params requeridos (orden alfabético al firmar)
    const baseParams: Record<string, string> = {
      amount: String(amount),
      apiKey: FLOW_API_KEY,
      commerceOrder,
      currency,
      email,
      subject,
      urlConfirmation,
      urlReturn,
      // Puedes agregar meta como planId explícito:
      // flow acepta params extra y los reenvía en el webhook:
      planId,
    };

    const { s, bodyStr } = await signFlow(baseParams, FLOW_SECRET_KEY);
    const body = `${bodyStr}&s=${encodeURIComponent(s)}`;

    const resp = await fetch(FLOW_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body,
    });

    const text = await resp.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* deja text crudo */ }

    if (!resp.ok || !(data && data.url)) {
      return NextResponse.json(
        {
          error: "Error al crear pago en Flow",
          detalle: data || text,
          // ÚTIL para depurar firma en logs (NO en producción final):
          // NOTE: comenta estas líneas si ya quedó estable
          debug: {
            FLOW_ENV,
            host: FLOW_HOST,
            sent: baseParams,
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado en Flow" }, { status: 500 });
  }
}
