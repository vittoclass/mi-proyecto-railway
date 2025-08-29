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

    // Llamada ATÓMICA al backend (no hay condiciones en el cliente)
    const { data, error } = await supabase.rpc("grant_free_once", {
      p_email: email,
      p_amount: 10,
    });

    if (error) {
      // Esto aparece en Logs de Railway y nos dice la causa real
      console.error("grant_free_once error:", error);
      return NextResponse.json({ error: "No se pudo crear saldo" }, { status: 500 });
    }

    // data === true -> se otorgó ahora; data === false -> ya estaba usado
    const creditsGranted = data ? 10 : 0;
    return NextResponse.json({ ok: true, creditsGranted });
  } catch (e: any) {
    console.error("gratis endpoint error:", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
