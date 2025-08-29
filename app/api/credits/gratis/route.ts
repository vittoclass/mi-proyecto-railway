import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // SERVICE ROLE (server only)
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

    // 1) Leer si ya existe
    const { data: row, error: selErr } = await supabase
      .from("user_credits")
      .select("email, credits, free_used")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      console.error("select user_credits error:", selErr);
      return NextResponse.json({ error: "No se pudo leer saldo" }, { status: 500 });
    }

    // 2) Si ya usó el gratis => no dar de nuevo
    if (row?.free_used) {
      return NextResponse.json({ ok: true, creditsGranted: 0 });
    }

    const GRANT = 10;

    if (!row) {
      // 3a) No existe: crear registro nuevo con 10 créditos
      const { error: insErr } = await supabase
        .from("user_credits")
        .insert({
          email,
          credits: GRANT,
          free_used: true,
          last_order: "free-activation"
        });

      if (insErr) {
        console.error("insert user_credits error:", insErr);
        return NextResponse.json({ error: "No se pudo crear saldo" }, { status: 500 });
      }
    } else {
      // 3b) Existe y no ha usado gratis: sumar 10 y marcar usado
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
