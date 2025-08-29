import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function mask(v?: string | null) {
  if (!v) return "MISSING";
  return v.slice(0, 6) + "…" + v.slice(-4);
}
function sha6(v?: string | null) {
  if (!v) return "MISSING";
  return crypto.createHash("sha256").update(v).digest("hex").slice(0, 6);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  try {
    const URL = process.env.SUPABASE_URL || "";
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    // Reporte seguro de ENV (enmascarado, no expone secretos)
    const envReport = {
      SUPABASE_URL: mask(URL),
      SUPABASE_URL_hash: sha6(URL),
      SERVICE_ROLE_KEY: mask(KEY),
      SERVICE_ROLE_KEY_hash: sha6(KEY),
      hasURL: !!URL,
      hasKey: !!KEY,
      nodeEnv: process.env.NODE_ENV || "unknown",
    };
    if (!URL || !KEY) {
      return res.status(500).json({ ok: false, stage: "env", envReport, error: "Missing ENV" });
    }

    // Probar escritura mínima (insert + delete) en user_credits
    const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
    const testEmail = `diag+${Date.now()}@example.com`;

    const { error: insErr } = await supabase
      .from("user_credits")
      .insert({ email: testEmail, credits: 1, free_used: false, last_order: "_diag" });
    if (insErr) {
      return res.status(500).json({ ok: false, stage: "insert", envReport, supabaseError: insErr });
    }

    const { error: delErr } = await supabase
      .from("user_credits")
      .delete()
      .eq("email", testEmail);
    if (delErr) {
      return res.status(500).json({ ok: false, stage: "cleanup", envReport, supabaseError: delErr });
    }

    return res.status(200).json({ ok: true, stage: "done", envReport });
  } catch (e: any) {
    return res.status(500).json({ ok: false, stage: "fatal", error: e?.message || String(e) });
  }
}
