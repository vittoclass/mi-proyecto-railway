import type { NextApiRequest, NextApiResponse } from "next";

function authHeader() {
  const token = Buffer.from(
    `${process.env.KHIPU_COLLECTOR_ID}:${process.env.KHIPU_SECRET}`
  ).toString("base64");
  return `Basic ${token}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const paymentId = body?.payment_id || body?.id;
    if (!paymentId) return res.status(400).json({ ok: false, error: "Falta payment_id" });

    const apiBase = process.env.KHIPU_BASE || "https://khipu.com/api/3.0";

    const r = await fetch(`${apiBase}/payments/${paymentId}`, {
      headers: { Authorization: authHeader() },
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const pago = await r.json();

    if (pago?.status === "done") {
      return res.status(200).json({ ok: true, status: "paid" });
    }
    return res.status(200).json({ ok: false, status: pago?.status || "unknown" });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Error en webhook" });
  }
}
