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
    const { userEmail } = await req.json();
    const email = String(userEmail || "").trim().toLowerCase();

    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    const GRANT = 10;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1) Buscar fila existente
    const { data: row, error: selErr } = await supabase
      .from("user_credits")
      .select("email, credits, free_used")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      console.error("select user_credits error:", selErr);
      return NextResponse.json({ error: "No se pudo leer saldo" }, { status: 500 });
    }

    // 2) Ya usó gratis → no dar de nuevo
    if (row?.free_used) {
      return NextResponse.json({ ok: true, creditsGranted: 0 });
    }

    if (!row) {
      // 3a) Nuevo usuario → crear con saldo gratis
      const { error: insErr } = await supabase.from("user_credits").insert({
        email,
        credits: GRANT,
        free_used: true,
        last_order: "free-activation",
        expires_at: expiresAt, // 👈 CLAVE
      });
      if (insErr) {
        console.error("insert user_credits error:", insErr);
        return NextResponse.json({ error: "No se pudo crear saldo" }, { status: 500 });
      }
    } else {
      // 3b) Ya existe pero no usó gratis → actualizar
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          credits: (row.credits ?? 0) + GRANT,
          free_used: true,
          last_order: "free-activation",
          expires_at: expiresAt, // 👈 CLAVE
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);
      if (updErr) {
        console.error("update user_credits error:", updErr);
        return NextResponse.json({ error: "No se pudo actualizar saldo" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, creditsGranted: GRANT });
  } catch (e: any) {
    console.error("gratis endpoint fatal:", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
