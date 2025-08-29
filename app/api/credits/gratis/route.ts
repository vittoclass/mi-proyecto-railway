import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service Role (server-only)
  { auth: { persistSession: false } }
);

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(req: Request) {
  try {
    // Acepta JSON o form
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let email = "";
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      email = String(body?.userEmail || "").trim().toLowerCase();
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData();
      email = String(form.get("userEmail") || "").trim().toLowerCase();
    } else {
      const body = await req.json().catch(() => ({}));
      email = String(body?.userEmail || "").trim().toLowerCase();
    }

    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    const GRANT = 10;

    // Lee si existe y si ya usó gratis
    const { data: row, error: selErr } = await supabase
      .from("user_credits")
      .select("email, credits, free_used")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: "No se pudo leer saldo", supabaseError: selErr }, { status: 500 });
    }

    if (row?.free_used) {
      return NextResponse.json({ ok: true, creditsGranted: 0 });
    }

    // Crea o actualiza. La BD ahora tiene defaults (incluye expires_at)
    if (!row) {
      const { error: insErr } = await supabase
        .from("user_credits")
        .insert({
          email,
          credits: GRANT,
          free_used: true,
          last_order: "free-activation"
        });
      if (insErr) {
        return NextResponse.json({ error: "No se pudo crear saldo", supabaseError: insErr }, { status: 500 });
      }
    } else {
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          credits: (row.credits ?? 0) + GRANT,
          free_used: true,
          last_order: "free-activation",
          updated_at: new Date().toISOString()
        })
        .eq("email", email);
      if (updErr) {
        return NextResponse.json({ error: "No se pudo actualizar saldo", supabaseError: updErr }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, creditsGranted: GRANT });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
