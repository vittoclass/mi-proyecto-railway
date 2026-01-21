import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
function mask(v?: string|null){return !v?"MISSING":v.slice(0,6)+"…"+v.slice(-4)}

export async function GET() {
  const URL = process.env.SUPABASE_URL || "";
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const envReport = { SUPABASE_URL: mask(URL), SERVICE_ROLE_KEY: mask(KEY), hasURL: !!URL, hasKey: !!KEY };

  if (!URL || !KEY) return NextResponse.json({ ok:false, stage:"env", envReport }, { status:500 });

  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
  const testEmail = `diag+${Date.now()}@example.com`;
  const expiresAt = new Date(Date.now()+30*24*60*60*1000).toISOString();

  const { error: insErr } = await supabase.from("user_credits").insert({
    email: testEmail, credits: 1, free_used: false, last_order: "_diag", expires_at: expiresAt
  });
  if (insErr) return NextResponse.json({ ok:false, stage:"insert", envReport, supabaseError: insErr }, { status:500 });

  const { error: delErr } = await supabase.from("user_credits").delete().eq("email", testEmail);
  if (delErr) return NextResponse.json({ ok:false, stage:"cleanup", envReport, supabaseError: delErr }, { status:500 });

  return NextResponse.json({ ok:true, stage:"done", envReport });
}
