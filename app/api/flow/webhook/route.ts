// app/api/flow/webhook/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || "";

// Créditos por plan (igual que en create y tu UI)
const PLAN_CREDITS: Record<string, number> = {
  basic: 90,
  intermediate: 640,
  pro: 1280,
};

// ===== SUPABASE opcional =====
async function addCreditsSupabase(email: string, creditsToAdd: number, orderId: string, planId: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  // Tabla sugerida:
  // user_credits (email text PK, credits int, free_used bool default false, updated_at timestamptz, last_order text)
  // payments (order_id text PK, email text, plan_id text, amount int, provider text, status text, created_at timestamptz)
  const now = new Date().toISOString();

  // idempotencia: si el pago existe, no duplicar
  const { data: existing } = await supabase
    .from("payments")
    .select("order_id,status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.status === "paid") {
    return true;
  }

  // Upsert pago como paid
  await supabase.from("payments").upsert({
    order_id: orderId,
    email,
    plan_id: planId,
    amount: null,     // si quieres, guarda el monto
    provider: "flow",
    status: "paid",
    created_at: now,
  });

  // Sumar créditos
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

  return true;
}

// ===== Memoria temporal si no hay Supabase (para test quick) =====
const mem = (global as any).__memCredits || new Map<string, { credits: number; orders: Set<string> }>();
(global as any).__memCredits = mem;

function addCreditsMemory(email: string, creditsToAdd: number, orderId: string) {
  const rec = mem.get(email) || { credits: 0, orders: new Set<string>() };
  if (rec.orders.has(orderId)) return; // idempotente
  rec.credits += creditsToAdd;
  rec.orders.add(orderId);
  mem.set(email, rec);
}

// ===== Verificación firma HMAC (Flow) =====
async function verifyFlowSignature(form: URLSearchParams) {
  if (!FLOW_SECRET_KEY) return false;
  const s = form.get("s") || "";
  const clone = new URLSearchParams();
  // Flow firma todos los campos EXCEPTO 's', en orden alfabético:
  const entries = [...form.entries()].filter(([k]) => k !== "s").sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of entries) clone.append(k, v);

  const { createHmac } = await import("crypto");
  const expect = createHmac("sha256", FLOW_SECRET_KEY).update(clone.toString()).digest("hex");
  return s === expect;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text(); // Flow envía x-www-form-urlencoded
    const form = new URLSearchParams(raw);

    // Ejemplos de campos que Flow suele enviar (puede variar):
    // - apiKey, commerceOrder, flowOrder, status, payer, payerEmail, amount, currency, ...
    // - custom params que mandaste (p.ej. email, plan)
    const okSig = await verifyFlowSignature(form);
    if (!okSig) {
      // IMPORTANTE: responde 200 igualmente para que Flow no reintente eternamente,
      // pero loguea el incidente (ajústalo si quieres fallar duro).
      console.warn("FLOW WEBHOOK: firma inválida");
      // return NextResponse.json({ ok: false, error: "Firma inválida" }, { status: 400 });
    }

    const status = form.get("status") || "";         // "paid" / "rejected" / ...
    const commerceOrder = form.get("commerceOrder") || ""; // el que generamos
    const flowOrder = form.get("flowOrder") || "";
    const email = String(form.get("email") || form.get("payerEmail") || "").toLowerCase();
    const planId = String(form.get("planId") || form.get("subject")?.split("—")[1] || "").trim() || "intermediate"; // heurística
    const amount = Number(form.get("amount") || "0");

    // Requisitos mínimos
    if (!email || !commerceOrder) {
      return NextResponse.json({ ok: false, error: "Payload incompleto" }, { status: 400 });
    }
    if (status !== "paid") {
      // Aceptamos notificación pero no acreditamos
      return NextResponse.json({ ok: true, info: `status=${status}` });
    }

    const creditsToAdd = PLAN_CREDITS[planId] || 0;
    if (creditsToAdd <= 0) {
      console.warn("FLOW WEBHOOK: planId inválido para acreditar", { planId });
      return NextResponse.json({ ok: true, info: "sin créditos (plan no mapeado)" });
    }

    // Primero intenta Supabase; si no está configurado, usa memoria
    const okDb = await addCreditsSupabase(email, creditsToAdd, commerceOrder, planId).catch(() => false);
    if (!okDb) {
      addCreditsMemory(email, creditsToAdd, commerceOrder);
    }

    return NextResponse.json({ ok: true, credited: creditsToAdd, email, planId, order: commerceOrder });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error webhook" }, { status: 500 });
  }
}

// Flow a veces hace GET de verificación: soporta GET como 200
export async function GET() {
  return NextResponse.json({ ok: true });
}
