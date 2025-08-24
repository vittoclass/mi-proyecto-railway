import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { userEmail } = await req.json();
    if (!userEmail || !/\S+@\S+\.\S+/.test(userEmail)) {
      return NextResponse.json({ ok: false, error: "Correo inválido" }, { status: 400 });
    }

    // Evita duplicados: 1 vez por correo
    const paymentId = `free-${userEmail.toLowerCase()}`;

    // Intenta insertar 15 créditos con vigencia 30 días
    const { error } = await supabase
      .from("user_credits")
      .insert({
        user_email: userEmail.toLowerCase(),
        credits_remaining: 15,
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        source: "free_plan",
        payment_id: paymentId,     // ÚNICO: si ya existe, falla y no duplica
        transaction_id: null,
        pack_id: "free-15",
      });

    if (error) {
      // Si ya lo activó antes, devolvemos ok con hint
      if (error.message?.toLowerCase().includes("duplicate key") || error.code === "23505") {
        return NextResponse.json({ ok: true, creditsGranted: 0, hint: "El plan gratuito ya fue activado." });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, creditsGranted: 15 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
