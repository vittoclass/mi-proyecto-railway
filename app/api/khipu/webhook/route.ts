import { NextRequest, NextResponse } from "next/server";

function authHeader() {
  const collector = process.env.KHIPU_COLLECTOR_ID!;
  const secret = process.env.KHIPU_SECRET!;
  const token = Buffer.from(`${collector}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const paymentId = body?.payment_id || body?.id;
    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "Falta payment_id" },
        { status: 400 }
      );
    }

    const apiBase = process.env.KHIPU_BASE || "https://khipu.com/api/3.0";
    // Consulta el estado del pago en Khipu
    const r = await fetch(`${apiBase}/payments/${paymentId}`, {
      method: "GET",
      headers: { Authorization: authHeader() },
      cache: "no-store",
    });

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: await r.text() },
        { status: r.status }
      );
    }

    const pago = await r.json();
    if (pago?.status === "done") {
      // TODO: marcar en tu BD pago.transaction_id como pagado
      return NextResponse.json({ ok: true, status: "paid" });
    }
    return NextResponse.json({ ok: false, status: pago?.status || "unknown" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error en webhook" },
      { status: 500 }
    );
  }
}
