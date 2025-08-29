import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

function mask(v?: string | null) {
  if (!v) return "MISSING";
  return v.slice(0, 6) + "…" + v.slice(-4); // NO expone el secreto
}
function sha6(v?: string | null) {
  if (!v) return "MISSING";
  return crypto.createHash("sha256").update(v).digest("hex").slice(0, 6);
}

export async function GET() {
  try {
    const URL = process.env.SUPABASE_URL || "";
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    // 1) Reporte seguro de ENV (enmascarado)
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
      return NextResponse.json({ ok: false, stage: "env", envReport, error: "Missing ENV" }, { status: 500 });
    }

    // 2) Probar escritura mínima (insert + delete) para validar permisos
    const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
    const testEmail = `diag+${Date.now()}@example.com`;

    // insert
    const { error: insErr } = await supabase.from("user_credits").insert({ email: testEmail, credits: 1, free_used: false, last_order: "_diag" });
    if (insErr) {
      return NextResponse.json({ ok: false, stage: "insert", envReport, supabaseError: insErr }, { status: 500 });
    }

    // delete (limpia)
    const { error: delErr } = await supabase.from("user_credits").delete().eq("email", testEmail);
    if (delErr) {
      return NextResponse.json({ ok: false, stage: "cleanup", envReport, supabaseError: delErr }, { status: 500 });
    }

    return NextResponse.json({ ok: true, stage: "done", envReport });
  } catch (e: any) {
    return NextResponse.json({ ok: false, stage: "fatal", error: e?.message || String(e) }, { status: 500 });
  }
}
