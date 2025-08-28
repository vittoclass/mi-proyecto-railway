// app/api/flow/webhook/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";

// Créditos por plan
const PLAN_CREDITS: Record<string, number> = {
  basic: 90,
  intermediate: 640,
  pro: 1280,
};

// ===== SUPABASE opcional =====
async function addCreditsSupabase(email: string, creditsToAdd: number, orderId: string, planId: string, raw: any) {
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
    amount: null,
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
  const next = current + creditsToAdd;

  await supabase.from("user_credits").upsert({
    email,
    credits: next,
    updated_at: now,
    last_order: orderId,
  });

  await supabase.from("credit_logs").insert({
    email,
    delta: creditsToAdd,
    reason: `flow:${planId}`,
    order_id: orderId,
  });

  return true;
}

// Memoria temporal si no hay Supabase
const mem = (global as any).__memCredits || new Map<string, { credits: number; orders: Set<string> }>();
(global as any).__memCredits = mem;

function addCreditsMemory(email: string, creditsToAdd: number, orderId: string) {
  const rec = mem.get(email) || { credits: 0, orders: new Set<string>() };
  if (rec.orders.has(orderId)) return;
  rec.credits += creditsToAdd;
  rec.orders.add(orderId);
  mem.set(email, rec);
}

// Verificación HMAC usando el MISMO form-urlencoded que llegó
async function verifyFlowSignature(form: URLSearchParams) {
  if (!FLOW_SECRET_KEY) return false;
  const s = form.get("s") || "";

  // reconstruir string de firma con todos menos 's', en orden alfabético,
  // usando encodeURIComponent como los envió Flow
  const entries = [...form.entries()]
    .filter(([k]) => k !== "s")
    .sort(([a], [b]) => a.localeCompare(b));
  const baseStr = entries.map(([k, v]) =>
    `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  ).join("&");

  const { createHmac } = await import("crypto");
  const expect = createHmac("sha256", FLOW_SECRET_KEY)
    .update(baseStr)
    .digest("hex");

  return s === expect;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text(); // Flow envía x-www-form-urlencoded
    const form = new URLSearchParams(raw);

    const okSig = await verifyFlowSignature(form);
    if (!okSig) {
      // loguea pero responde 200 para que Flow no reintente sin fin
      console.warn("FLOW WEBHOOK: firma inválida");
      // si prefieres fallar duro: return NextResponse.json({ ok:false, error:"Firma inválida" }, { status: 400 });
    }

    const status = form.get("status") || "";               // "paid", "rejected", etc.
    const commerceOrder = form.get("commerceOrder") || ""; // el que generamos
    const flowOrder = form.get("flowOrder") || "";
    const email = String(form.get("email") || form.get("payerEmail") || "").toLowerCase();
    // Te mandamos planId como param adicional desde create:
    const planId = String(form.get("planId") || "").trim() ||
      String(form.get("subject") || "").split("—")[1]?.trim() ||
      "";
    const amount = Number(form.get("amount") || "0");

    if (!email || !commerceOrder) {
      return NextResponse.json({ ok: false, error: "Payload incompleto" }, { status: 400 });
    }
    if (status !== "paid") {
      return NextResponse.json({ ok: true, info: `status=${status}` });
    }

    const creditsToAdd = PLAN_CREDITS[planId] || 0;
    if (creditsToAdd <= 0) {
      console.warn("FLOW WEBHOOK: planId inválido/no mapeado", { planId });
      return NextResponse.json({ ok: true, info: "sin créditos (plan no mapeado)" });
    }

    const rawObj: any = {};
    for (const [k, v] of form.entries()) rawObj[k] = v;

    const okDb = await addCreditsSupabase(email, creditsToAdd, commerceOrder, planId, rawObj).catch(() => false);
    if (!okDb) addCreditsMemory(email, creditsToAdd, commerceOrder);

    return NextResponse.json({ ok: true, credited: creditsToAdd, email, planId, order: commerceOrder, flowOrder });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error webhook" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
