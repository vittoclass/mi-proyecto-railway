import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ========== GET (para probar fácil en el navegador) ==========
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("userEmail");

    // Sin email: muestra hint + check de envs
    if (!email) {
      const haveUrl = Boolean(process.env.SUPABASE_URL);
      const haveKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      return NextResponse.json({
        ok: true,
        hint: "Agrega ?userEmail=correo@dominio.cl a la URL o usa POST",
        env: { SUPABASE_URL: haveUrl, SUPABASE_SERVICE_ROLE_KEY: haveKey }
      });
    }

    // Ping a la tabla para detectar problemas de conexión/permiso
    const ping = await supabase.from("user_credits").select("id").limit(1);
    if (ping.error) {
      return NextResponse.json({ step: "PING", error: ping.error.message }, { status: 500 });
    }

    // Consulta la vista de saldo
    const { data, error } = await supabase
      .from("v_user_credit_balance")
      .select("*")
      .eq("user_email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ step: "QUERY_VIEW", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saldo: data?.credits_remaining ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ step: "UNCAUGHT", error: String(e?.message || e) }, { status: 500 });
  }
}

// ========== POST (para llamadas desde tu app) ==========
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.userEmail;
    if (!email) return NextResponse.json({ error: "Falta userEmail" }, { status: 400 });

    const ping = await supabase.from("user_credits").select("id").limit(1);
    if (ping.error) {
      return NextResponse.json({ step: "PING", error: ping.error.message }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("v_user_credit_balance")
      .select("*")
      .eq("user_email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ step: "QUERY_VIEW", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saldo: data?.credits_remaining ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ step: "UNCAUGHT", error: String(e?.message || e) }, { status: 500 });
  }
}
