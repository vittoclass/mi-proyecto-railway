import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --- Supabase (server only) ---
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // SERVICE ROLE (solo en servidor)
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

    // 1) Leer registro actual (credits, free_used)
    const { data: row, error: selErr } = await supabase
      .from("user_credits")
      .select("email, credits, free_used")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: "Error leyendo saldo" }, { status: 500 });
    }

    // 2) Si ya usó el gratis, no volvemos a otorgar
    if (row?.free_used) {
      return NextResponse.json({ ok: true, creditsGranted: 0 });
    }

    const creditsGranted = 10; // GRATIS = 10

    // 3) Otorgar gratis una sola vez
    if (row) {
      // existe: sumar y marcar free_used
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          credits: (row.credits ?? 0) + creditsGranted,
          free_used: true,
          updated_at: new Date().toISOString(),
          last_order: "free-activation"
        })
        .eq("email", email);

      if (updErr) {
        return NextResponse.json({ error: "No se pudo actualizar créditos" }, { status: 500 });
      }
    } else {
      // no existe: crear con credits = 10 y free_used = true
      const { error: insErr } = await supabase
        .from("user_credits")
        .insert({
          email,
          credits: creditsGranted,
          free_used: true,
          last_order: "free-activation"
        });

      if (insErr) {
        return NextResponse.json({ error: "No se pudo crear el saldo" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, creditsGranted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
