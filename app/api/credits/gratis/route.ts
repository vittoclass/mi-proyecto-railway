import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(req: Request) {
  try {
    // Soporta JSON o form-data
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let email = "";
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      email = String(body?.userEmail || "").trim().toLowerCase();
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData();
      email = String(form.get("userEmail") || "").trim().toLowerCase();
    } else {
      // intentar igual como JSON por si el front no puso el header
      const body = await req.json().catch(() => ({}));
      email = String(body?.userEmail || "").trim().toLowerCase();
    }

    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    const GRANT = 10;

    // 1) Buscar si existe
    const { data: row, error: selErr } = await supabase
      .from("user_credits")
      .select("email, credits, free_used")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: "No se pudo leer saldo", supabaseError: selErr }, { status: 500 });
    }

    // 2) Ya usó gratis → no regalar otra vez
    if (row?.free_used) {
      return NextResponse.json({ ok: true, creditsGranted: 0 });
    }

    // 3) Crear o actualizar (la BD ahora rellena expires_at por default)
    if (!row) {
      const { error: insErr } = await supabase.from("user_credits").insert({
        email,
        credits: GRANT,
        free_used: true,
        last_order: "free-activation",
        // expires_at: omitido a propósito (la BD lo rellena por default)
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
          updated_at: new Date().toISOString(),
          // expires_at: omitido (default ya existe y probablemente ya estaba seteado)
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
