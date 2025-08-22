import type { NextApiRequest, NextApiResponse } from "next";

function authHeader(): string {
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
      return res.status(400).json({ error: "Monto invalido" });
    }

    // 🔎 Normalizamos KHIPU_BASE (sin espacios, sin slash final)
    const rawBase = (process.env.KHIPU_BASE || "https://khipu.com/api/3.0").trim();
    const base = rawBase.replace(/\/+$/, ""); // quita / al final
    const url = `${base}/payments`;

    const body = {
      subject: glosa || "Pago LibelIA",
      amount: Number(monto),
      currency: "CLP",
      transaction_id: txid || `orden-${Date.now()}`,
      return_url: process.env.PUBLIC_RETURN_URL,
      cancel_url: process.env.PUBLIC_CANCEL_URL,
      notify_url: process.env.PUBLIC_NOTIFY_URL
    };

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": authHeader()
    } as const;

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    // Si falla, devolvemos diagnostico completo
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({
        error: "Khipu devolvio error",
        status: r.status,
        used_url: url,
        khipu_base_env: rawBase,
        note: "Revisa que KHIPU_BASE no tenga espacios y sea https://khipu.com/api/3.0",
        response_preview: text.slice(0, 500)
      });
    }

    const resp = await r.json();
    return res.status(200).json({ payment_url: resp.payment_url, payment_id: resp.payment_id, used_url: url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Error creando pago" });
  }
}
