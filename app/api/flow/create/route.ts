// app/api/flow/create/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ENV requeridos en Railway:
const FLOW_API_KEY = process.env.FLOW_API_KEY || "";
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Map de créditos por plan (debe calzar con tu UI)
const PLAN_CREDITS: Record<string, number> = {
  basic: 90,            // Khipu (pero igual lo dejo por si lo usas)
  intermediate: 640,    // Flow
  pro: 1280,            // Flow
};

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

    // Flow: crear orden
    const commerceOrder = Date.now().toString(); // único
    const subject = `Libel-IA — ${planId}`;
    const currency = "CLP";
    const amount = Number(precioCLP);

    const urlReturn = `${BASE_URL}/pagos/success?plan=${planId}`;
    const urlConfirmation = `${BASE_URL}/api/flow/webhook`; // webhook

    // Build params en orden alfabético (Flow firma así)
    const pairs: [string, string][] = [
      ["amount", String(amount)],
      ["apiKey", FLOW_API_KEY],
      ["commerceOrder", commerceOrder],
      ["currency", currency],
      ["email", String(userEmail).toLowerCase()],
      ["subject", subject],
      ["urlConfirmation", urlConfirmation],
      ["urlReturn", urlReturn],
    ];

    const params = new URLSearchParams();
    for (const [k, v] of pairs) params.append(k, v);

    // Firma HMAC-SHA256
    const { createHmac } = await import("crypto");
    const baseString = params.toString(); // clave: orden alfabético
    const s = createHmac("sha256", FLOW_SECRET_KEY).update(baseString).digest("hex");
    params.append("s", s);

    // Crear pago
    const resp = await fetch("https://www.flow.cl/api/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.url) {
      return NextResponse.json(
        { error: "Error al crear pago en Flow", detalle: data },
        { status: 502 }
      );
    }

    // Devolvemos la URL donde el cliente debe ir a pagar
    return NextResponse.json({ url: data.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error inesperado en Flow" }, { status: 500 });
  }
}
