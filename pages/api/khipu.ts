import type { NextApiRequest, NextApiResponse } from "next";

function apiBase(): string {
  const raw = (process.env.KHIPU_BASE || "https://payment-api.khipu.com/v3").trim();
  return raw.replace(/\/+$/, ""); // sin slash final
}

function apiKey(): string {
  const key = process.env.KHIPU_API_KEY || "";
  if (!key) throw new Error("Falta KHIPU_API_KEY");
  return key;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { monto, glosa, txid } = req.body || {};
    if (!monto || Number.isNaN(Number(monto))) {
      return res.status(400).json({ error: "Monto invalido" });
    }

    const body = {
      subject: glosa || "Pago LibelIA",
      amount: Number(monto),
      currency: "CLP",
      transaction_id: txid || `orden-${Date.now()}`,
      return_url: process.env.PUBLIC_RETURN_URL,
      cancel_url: process.env.PUBLIC_CANCEL_URL,
      notify_url: process.env.PUBLIC_NOTIFY_URL
    };

    const url = `${apiBase()}/payments`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": apiKey()
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({
        error: "Khipu devolvio error",
        status: r.status,
        used_url: url,
        response_preview: text.slice(0, 400)
      });
    }

    const data = JSON.parse(text);
    return res.status(200).json({ payment_url: data?.payment_url, payment_id: data?.payment_id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Error creando pago" });
  }
}