import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== ENVs =====
// Por defecto nos vamos a PRODUCCIÓN.
// Cambia FLOW_ENV=sandbox sólo si quieres probar en sandbox.
const FLOW_ENV = (process.env.FLOW_ENV || "prod").toLowerCase(); // "prod" | "sandbox"
const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

// Host según ambiente
const FLOW_HOST = FLOW_ENV === "sandbox" ? "https://sandbox.flow.cl" : "https://www.flow.cl";
const CREATE_URL = `${FLOW_HOST}/api/payment/create`;

// Planes soportados (deben calzar con tu UI)
const PLAN_PRICE: Record<string, number> = {
  intermediate: 29900,
  pro: 49900,
};

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: Request) {
  try {
    const { userEmail, planId, precioCLP } = await req.json();

    // Validaciones de entrada
    if (!userEmail || !isValidEmail(String(userEmail))) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!planId || !PLAN_PRICE[planId]) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }
    if (Number(precioCLP) !== PLAN_PRICE[planId]) {
      return NextResponse.json({ error: "Precio no coincide con el plan" }, { status: 400 });
    }

    // Validaciones de entorno
    if (!FLOW_API_KEY) {
      return NextResponse.json({ error: "Falta FLOW_API_KEY (producción)" }, { status: 500 });
    }
    if (!FLOW_SECRET_KEY) {
      return NextResponse.json({ error: "Falta FLOW_SECRET_KEY (producción)" }, { status: 500 });
    }
    if (!BASE_URL || !BASE_URL.startsWith("https://")) {
      return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL debe ser una URL pública https" }, { status: 400 });
    }

    // Datos del pago
    const email = String(userEmail).toLowerCase();
    const amount = PLAN_PRICE[planId];
    const currency = "CLP";
    const commerceOrder = Date.now().toString(); // único por request
    // Subject ASCII (evita problemas de firma)
    const subject = `LibelIA-plan-${planId}`;

    const urlReturn = `${BASE_URL}/pagos/success?plan=${encodeURIComponent(planId)}`;
    const urlConfirmation = `${BASE_URL}/api/flow/webhook`;

    // Params mínimos (orden alfabético estricto)
    const params: Record<string, string> = {
      amount: String(amount),
      apiKey: FLOW_API_KEY,
      commerceOrder,
      currency,
      email,
      subject,
      urlConfirmation,
      urlReturn,
    };

    // Firma HMAC-SHA256 sobre la CADENA URL-ENCODED ORDENADA ALFABÉTICAMENTE
    const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
    const bodyStr = entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", FLOW_SECRET_KEY).update(bodyStr).digest("hex");
    const body = `${bodyStr}&s=${encodeURIComponent(signature)}`;

    // Llamada a Flow (PRODUCCIÓN si FLOW_ENV=prod)
    const resp = await fetch(CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body,
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => ({} as any));
      if (data?.url) {
        return NextResponse.json({ url: data.url });
      }
    }

    // Error: devolvemos un resumen (sin exponer secretos)
    let text = "";
    try { text = await resp.text(); } catch {}
    return NextResponse.json(
      {
        error: "Error al crear pago en Flow",
        status: resp.status,
        info: text?.slice(0, 500) || "sin detalle",
        env: FLOW_ENV, // para ver a qué ambiente pegaste
      },
      { status: 502 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
