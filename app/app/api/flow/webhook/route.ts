import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";

// Créditos por plan (coincidir con UI)
const PLAN_CREDITS: Record<string, number> = {
  intermediate: 640,
  pro: 1280,
};

function parsePlanFromSubject(subject: string): string | null {
  // subject = "LibelIA-plan-intermediate"
  const m = /^LibelIA-plan-([a-z0-9_-]+)$/i.exec(subject || "");
  return m?.[1]?.toLowerCase() || null;
}

async function verifySignature(form: URLSearchParams): Promise<boolean> {
  if (!FLOW_SECRET_KEY) return false;
  const s = form.get("s") || "";
  const entries = [...form.entries()].filter(([k]) => k !== "s").sort(([a], [b]) => a.localeCompare(b));
  const baseStr = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const { createHmac } = await import("crypto");
  const expect = createHmac("sha256", FLOW_SECRET_KEY).update(baseStr).digest("hex");
  return s === expect;
}

async function addCreditsSupabase(email: string, amount: number, orderId: string, planId: string, raw: Record<string, string>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);
  const now = new Date().toISOString();

  // idempotencia por order_id
  const { data: existing } = await supabase
    .from("payments")
    .select("order_id, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.status === "paid") return true;

  await supabase.from("payments").upsert({
    order_id: orderId,
    provider: "flow",
    plan_id: planId,
    email,
    amount,
    status: "paid",
    raw,
    created_at: now,
    updated_at: now,
  });

  const { data: row } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("email", email)
    .maybeSingle();

  const current = Number(row?.credits ?? 0);
  const next = current + amount;

  await supabase.from("user_credits").upsert({
    email,
    credits: next,
    updated_at: now,
    last_order: orderId,
  });

  await supabase.from("credit_logs").insert({
    email,
    delta: amount,
    reason: `flow:${planId}`,
    order_id: orderId,
  });

  return true;
}

export async function POST(req: Request) {
  try {
    const rawText = await req.text();               // x-www-form-urlencoded
    const form = new URLSearchParams(rawText);

    // Verificación HMAC (si falla, registramos pero no reintentamos infinito)
    const okSig = await verifySignature(form);
    if (!okSig) {
      console.warn("FLOW webhook: firma inválida");
      // return NextResponse.json({ ok: false, error: "Firma inválida" }, { status: 400 });
    }

    const status = form.get("status") || "";
    const commerceOrder = form.get("commerceOrder") || "";
    const subject = form.get("subject") || "";
    const email = String(form.get("email") || form.get("payerEmail") || "").toLowerCase();
    const planId = parsePlanFromSubject(subject);
    const amount = Number(form.get("amount") || "0");

    if (!email || !commerceOrder || !planId) {
      return NextResponse.json({ ok: false, error: "Payload incompleto" }, { status: 400 });
    }
    if (status !== "paid") {
      return NextResponse.json({ ok: true, info: `status=${status}` });
    }

    const credits = PLAN_CREDITS[planId] || 0;
    if (credits <= 0) {
      console.warn("FLOW webhook: plan no mapeado", { planId });
      return NextResponse.json({ ok: true, info: "sin acreditación (plan no mapeado)" });
    }

    const rawObj: Record<string, string> = {};
    for (const [k, v] of form.entries()) rawObj[k] = v;

    const ok = await addCreditsSupabase(email, credits, commerceOrder, planId, rawObj).catch(() => false);
    if (!ok) {
      console.error("No se pudo acreditar en Supabase");
      return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email, planId, order: commerceOrder, credited: credits });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error webhook" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
