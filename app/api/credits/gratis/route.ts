import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // SERVICE ROLE (solo servidor)
  { auth: { persistSession: false } }
);

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(req: Request) {
  try {
    // Asegurar JSON
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type inválido" }, { status: 415 });
    }

    const { userEmail } = await req.json();
    const email = String(userEmail || "").trim().toLowerCase();
    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    const GRANT = 10;
    // Vigencia: 30 días
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1) Buscar si ya existe registro
    const { data: row, error: selErr } = await supabase
      .from("user_credits")
      .select("email, credits, free_used")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      console.error("select user_credits error:", selErr);
      return NextResponse.json({ error: "No se pudo leer saldo" }, { status: 500 });
    }

    // 2) Si ya usó gratis => no otorgar otra vez
    if (row?.free_used) {
      return new NextResponse(JSON.stringify({ ok: true, creditsGranted: 0 }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    // 3) Crear o actualizar con expires_at
    if (!row) {
      const { error: insErr } = await supabase.from("user_credits").insert({
        email,
        credits: GRANT,
        free_used: true,
        last_order: "free-activation",
        expires_at: expiresAt, // 👈 requerido por tu BD
      });
      if (insErr) {
        console.error("insert user_credits error:", insErr);
        return NextResponse.json({ error: "No se pudo crear saldo" }, { status: 500 });
      }
    } else {
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          credits: (row.credits ?? 0) + GRANT,
          free_used: true,
          last_order: "free-activation",
          expires_at: expiresAt, // 👈 requerido por tu BD
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);
      if (updErr) {
        console.error("update user_credits error:", updErr);
        return NextResponse.json({ error: "No se pudo actualizar saldo" }, { status: 500 });
      }
    }

    return new NextResponse(JSON.stringify({ ok: true, creditsGranted: GRANT }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("gratis endpoint fatal:", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
