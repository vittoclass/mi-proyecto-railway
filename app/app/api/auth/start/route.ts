import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const { error: e1 } = await supabaseAdmin
      .from("auth_codes")
      .insert({ email: email.toLowerCase(), code, expires_at: expiresAt });
    if (e1) {
      console.error("auth/start insert error", e1);
      return NextResponse.json({ ok: false, error: "No se pudo generar el código" }, { status: 500 });
    }

    await sendEmail({
      to: email,
      subject: "Tu código de acceso — Libel-IA",
      html: `
        <h2>Tu código de acceso</h2>
        <p>Usa este código en Libel-IA:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:3px;">${code}</p>
        <p>Expira en 10 minutos.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("auth/start error", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error" }, { status: 500 });
  }
}
