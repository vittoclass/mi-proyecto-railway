import { NextRequest, NextResponse } from "next/server";

function authHeader() {
  const collector = process.env.KHIPU_COLLECTOR_ID!;
  const secret = process.env.KHIPU_SECRET!;
  const token = Buffer.from(`${collector}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const { monto, glosa, txid } = await req.json();
    if (!monto || Number.isNaN(Number(monto))) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const body = {
      subject: glosa || "Pago LibelIA",
      amount: Number(monto),
      currency: "CLP",
      transaction_id: txid || `orden-${Date.now()}`,
      return_url: process.env.PUBLIC_RETURN_URL,
      cancel_url: process.env.PUBLIC_CANCEL_URL,
      notify_url: process.env.PUBLIC_NOTIFY_URL, // -> /api/khipu/webhook
    };

    const apiBase = process.env.KHIPU_BASE || "https://khipu.com/api/3.0";

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
      return NextResponse.json({ error: await r.text() }, { status: r.status });
    }

    const resp = await r.json();
    // <- ESTO es lo que necesitas para redirigir al pago
    return NextResponse.json({
      payment_url: resp.payment_url,
      payment_id: resp.payment_id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error creando pago" },
      { status: 500 }
    );
  }
}
