// app/api/credits/saldo/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  { auth: { persistSession: false } }
);

// Validación relajada: evita falsos negativos con correos institucionales
const isEmailValid = (e: string) => {
  const email = (e || "").trim().toLowerCase();
  return email.length > 3 && email.includes("@");
};

export async function GET(req: Request) {
  try {
    // Acepta ?userEmail= o ?email=
    const { searchParams } = new URL(req.url);
    const rawEmail = String(
      searchParams.get("userEmail") ?? searchParams.get("email") ?? ""
    ).trim().toLowerCase();

    if (!isEmailValid(rawEmail)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    // Tabla coherente con tu uso actual: user_credits(email, credits)
    const { data: row, error } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("email", rawEmail)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `Error leyendo saldo: ${error.message}` },
        { status: 500 }
      );
    }

    const saldo = Number(row?.credits ?? 0);

    return new NextResponse(JSON.stringify({ saldo }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error" },
      { status: 500 }
    );
  }
}
