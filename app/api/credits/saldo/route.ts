import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  { auth: { persistSession: false } }
);

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(searchParams.get("userEmail") || "").trim().toLowerCase();

    if (!isEmailValid(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Error leyendo saldo" }, { status: 500 });
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
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
