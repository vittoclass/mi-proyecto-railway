import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawBase = (process.env.KHIPU_BASE || "https://khipu.com/api/3.0");
  const trimmed = rawBase.trim();
  const normalized = trimmed.replace(/\/+$/, ""); // sin slash final
  const url = `${normalized}/payments`;

  // Intento GET para ver si responde 200/405/404 en esa URL
  // (Khipu deberia dar 405/404 en GET, pero nos interesa el status y que la URL sea la esperada)
  let probeStatus = -1;
  try {
    const r = await fetch(url, { method: "GET" });
    probeStatus = r.status;
  } catch (e:any) {
    probeStatus = -2; // error de red
  }

  res.status(200).json({
    khipu_base_env_raw: rawBase,
    khipu_base_trimmed: trimmed,
    khipu_base_normalized: normalized,
    used_url: url,
    probe_status_get: probeStatus
  });
}