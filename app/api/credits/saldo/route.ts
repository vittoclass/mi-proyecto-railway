import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// --- Helper: intenta leer email desde cookie "session" (JWT) ---
async function getEmailFromCookie(): Promise<string | null> {
  try {
    const token = cookies().get("session")?.value;
    if (!token) return null;
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "");
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const email = (payload as any)?.email as string | undefined;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

// ========== GET (para probar fácil en el navegador) ==========
// Prioridad: cookie -> ?userEmail
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cookieEmail = await getEmailFromCookie();
    const queryEmail = url.searchParams.get("userEmail");
    const email = (cookieEmail || queryEmail || "").toLowerCase();

    // Sin email: muestra hint + check de envs (mantengo tu comportamiento)
    if (!email) {
      const haveUrl = Boolean(process.env.SUPABASE_URL);
      const haveKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      return NextResponse.json({
        ok: true,
        hint: "Agrega ?userEmail=correo@dominio.cl a la URL o inicia sesión para que use la cookie",
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
// Prioridad: cookie -> body.userEmail
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const cookieEmail = await getEmailFromCookie();
    const bodyEmail = body?.userEmail as string | undefined;
    const email = (cookieEmail || bodyEmail || "").toLowerCase();

    if (!email) {
      // Cambiamos a 401 (no autenticado) si no hay email de cookie ni body
      return NextResponse.json({ error: "No autenticado: falta email" }, { status: 401 });
    }

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
