import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email"; // usamos la utilidad que hicimos en lib/email.ts

// GET /api/email/test?to=correo@dominio.com
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to");

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Falta parámetro ?to=correo" },
        { status: 400 }
      );
    }

    const result = await sendEmail({
      to,
      subject: "✅ Test de Libel-IA con Resend",
      html: `
        <h1>Hola!</h1>
        <p>Este es un correo de prueba enviado con <b>Resend</b> desde tu app Libel-IA 🚀.</p>
        <p>Si lo ves, ¡todo funciona correctamente!</p>
      `,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error("Error en /api/email/test:", error);
    return NextResponse.json(
      { ok: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}
