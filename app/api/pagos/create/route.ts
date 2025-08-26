// app/api/pagos/create/route.ts
import { NextResponse } from "next/server";

// Crea un pago en Khipu (API v3 - x-api-key, sin firmas)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userEmail = String(body?.userEmail || "").toLowerCase();
    const planId = String(body?.planId || "");
    // 👇 importante: amount en CLP, entero
    const amount = Math.round(Number(body?.precioCLP));

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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; // ej: http://localhost:3000 o https://tu-railway.app
    const apiKey = process.env.KHIPU_API_KEY;         // clave secreta v3 (x-api-key)

    if (!baseUrl) {
      return NextResponse.json({ error: "Falta NEXT_PUBLIC_BASE_URL" }, { status: 500 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "Falta KHIPU_API_KEY" }, { status: 500 });
    }

    // -------- URLs de retorno / cancelación / webhook --------
    // OJO: para producción, usa dominio público (no localhost) o Khipu lo rechaza.
    const return_url = `${baseUrl}/pagos/success?plan=${encodeURIComponent(planId)}`;
    const cancel_url = `${baseUrl}/pagos/cancel`;
    const notify_url = `${baseUrl}/api/pagos/webhook`;

    // -------- planes gratis: no llamar a Khipu --------
    if (amount === 0) {
      // aquí podrías acreditar créditos gratis si corresponde (en webhook/otro endpoint)
      return NextResponse.json({
        url: `${return_url}&free=1`
      });
    }

    // (opcional) límites para evitar errores típicos:
    // si tu Khipu está configurado con tope de 5.000.000 CLP:
    // if (amount > 5_000_000) {
    //   return NextResponse.json({ error: "amount excede el máximo permitido" }, { status: 400 });
    // }

    // -------- cuerpo v3 --------
    const payload = {
      subject: `Libel-IA — ${planId}`,
      amount,                 // entero CLP
      currency: "CLP",
      return_url,
      cancel_url,
      notify_url,
      send_email: false,
      send_reminders: false,
      custom: JSON.stringify({ userEmail, planId }),
      responsible_user_email: userEmail,
    };

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
      return NextResponse.json(
        { error: `Error Khipu (HTTP ${resp.status})`, detalle: data },
        { status: 502 }
      );
    }

    // v3 suele retornar payment_url (o simplified_transfer_url / transfer_url)
    const url = data?.payment_url || data?.simplified_transfer_url || data?.transfer_url || null;
    if (!url) {
      return NextResponse.json(
        { error: "Khipu no devolvió una URL de pago válida", detalle: data },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
