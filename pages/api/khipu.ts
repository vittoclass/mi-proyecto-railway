import type { NextApiRequest, NextApiResponse } from "next";

function authHeader() {
  const token = Buffer.from(
    `${process.env.KHIPU_COLLECTOR_ID}:${process.env.KHIPU_SECRET}`
  ).toString("base64");
  return `Basic ${token}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { monto, glosa, txid } = req.body || {};
    if (!monto || Number.isNaN(Number(monto))) {
      return res.status(400).json({ error: "Monto inválido" });
    }

    const body = {
      subject: glosa || "Pago LibelIA",
      amount: Number(monto),
      currency: "CLP",
      transaction_id: txid || `orden-${Date.now()}`,
      return_url: process.env.PUBLIC_RETURN_URL,
      cancel_url: process.env.PUBLIC_CANCEL_URL,
      notify_url: process.env.PUBLIC_NOTIFY_URL,
    };

    const apiBase = process.env.KHIPU_BASE || "https://khipu.com/api/3.0";
    const r = await fetch(`${apiBase}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify(body),
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const resp = await r.json();
    return res.status(200).json({ payment_url: resp.payment_url, payment_id: resp.payment_id });
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || "Error creando pago" });
  }
}
