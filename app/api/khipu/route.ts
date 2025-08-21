// 👇 fuerza a Next a tratar esta ruta como dinámica y en Node.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function authHeader() {
  const collector = process.env.KHIPU_COLLECTOR_ID!;
  const secret = process.env.KHIPU_SECRET!;
  const token = Buffer.from(`${collector}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

// GET: verificación de existencia
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/khipu" });
}

// POST: creación real del cobro
export async function POST(req: NextRequest) {
  try {
    const { monto, glosa, txid } = await req.json();

    if (!monto || Number.isNaN(Number(monto))) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const apiBase = process.env.KHIPU_BASE || "https://khipu.com/api/3.0";

    const body = {
      subject: glosa || "Pago LibelIA",
      amount: Number(monto),
      currency: "CLP",
      transaction_id: txid || `orden-${Date.now()}`,
      return_url: process.env.PUBLIC_RETURN_URL,
      cancel_url: process.env.PUBLIC_CANCEL_URL,
      notify_url: process.env.PUBLIC_NOTIFY_URL, // -> /api/khipu/webhook
    };

    const r = await fetch(`${apiBase}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: text || "Error Khipu" }, { status: r.status });
    }

    const resp = await r.json();
    return NextResponse.json({
      payment_url: resp.payment_url,
      payment_id: resp.payment_id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error creando pago" }, { status: 500 });
  }
}
