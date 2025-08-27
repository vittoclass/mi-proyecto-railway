// app/api/pagos/create/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userEmail = String(body?.userEmail || "").toLowerCase();
    const planId = String(body?.planId || "");
    const amount = Math.round(Number(body?.precioCLP)); // CLP entero

    // -------- validaciones de entrada --------
    if (!userEmail || !/\S+@\S+\.\S+/.test(userEmail)) {
      return NextResponse.json({ error: "Falta o es inválido userEmail" }, { status: 400 });
    }
    if (!planId) {
      return NextResponse.json({ error: "Falta planId" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "precioCLP inválido" }, { status: 400 });
    }

    // -------- env obligatorios --------
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; // ej: https://libel-ia.up.railway.app
    const apiKey = process.env.KHIPU_API_KEY;         // API v3 (x-api-key)
    const responsibleEmail = process.env.KHIPU_RESPONSIBLE_EMAIL || ""; // correo habilitado en Khipu
    // Límite opcional (por defecto 5000 si tu cuenta/plan lo exige)
    const khipuMax = Number(process.env.KHIPU_MAX_AMOUNT ?? 5000);

    if (!baseUrl) return NextResponse.json({ error: "Falta NEXT_PUBLIC_BASE_URL" }, { status: 500 });
    if (!apiKey) return NextResponse.json({ error: "Falta KHIPU_API_KEY" }, { status: 500 });

    // -------- URLs de retorno / cancelación / webhook --------
    const return_url = `${baseUrl}/pagos/success?plan=${encodeURIComponent(planId)}`;
    const cancel_url = `${baseUrl}/pagos/cancel`;
    const notify_url = `${baseUrl}/api/pagos/webhook`;

    // -------- plan gratis: sin Khipu --------
    if (amount === 0) {
      return NextResponse.json({ url: `${return_url}&free=1` });
    }

    // -------- protección por límite de Khipu --------
    if (khipuMax > 0 && amount > khipuMax) {
      return NextResponse.json(
        { error: `El monto (${amount}) excede el máximo permitido por Khipu (${khipuMax}).` },
        { status: 400 }
      );
    }

    // -------- payload v3 --------
    const payload: Record<string, any> = {
      subject: `Libel-IA — ${planId}`,
      amount,                 // CLP
      currency: "CLP",
      return_url,
      cancel_url,
      notify_url,
      send_email: false,
      send_reminders: false,
      custom: JSON.stringify({ userEmail, planId }),
    };

    // Usa SIEMPRE el email habilitado en Khipu (no el del comprador)
    if (responsibleEmail) {
      payload.responsible_user_email = responsibleEmail;
    }

    const resp = await fetch("https://payment-api.khipu.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (!resp.ok) {
      // Log detallado para depurar en Railway
      console.error("[KHIPU][ERROR]", { status: resp.status, data });
      return NextResponse.json(
        { error: `Error Khipu (HTTP ${resp.status})`, detalle: data },
        { status: 502 }
      );
    }

    const url = data?.payment_url || data?.simplified_transfer_url || data?.transfer_url || null;
    if (!url) {
      return NextResponse.json(
        { error: "Khipu no devolvió una URL de pago válida", detalle: data },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (e: any) {
    console.error("[KHIPU][EXCEPTION]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
