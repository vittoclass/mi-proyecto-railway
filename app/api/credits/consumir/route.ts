// app/api/credits/consumir/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== FALLBACK EN MEMORIA (para pruebas locales si no hay Supabase) ======
type MemRec = { credits: number; usedOps: Set<string> };
const mem = (global as any).__memCredits || new Map<string, MemRec>();
(global as any).__memCredits = mem;

function consumeFromMemory(email: string, amount: number, opId?: string) {
  const key = email.toLowerCase();
  const rec = mem.get(key) || { credits: 0, usedOps: new Set<string>() };
  if (opId && rec.usedOps.has(opId)) {
    // idempotente: no volver a descontar
    return rec.credits;
  }
  if (rec.credits < amount) {
    throw new Error("INSUFFICIENT_CREDITS");
  }
  rec.credits -= amount;
  if (opId) rec.usedOps.add(opId);
  mem.set(key, rec);
  return rec.credits;
}

// ====== SUPABASE (preferido) ======
async function consumeFromSupabase(email: string, amount: number, reason?: string, opId?: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  // Opción A: usar función SQL atómica (recomendado). Ver SQL más abajo.
  // consume_credits(email text, p_amount int, p_reason text, p_order_id text)
  const { data, error } = await supabase.rpc("consume_credits", {
    p_email: email.toLowerCase(),
    p_amount: amount,
    p_reason: reason || "evaluacion",
    p_order_id: opId || null,
  });

  if (error) {
    // Traducimos el error específico si la función lanza 'INSUFFICIENT_CREDITS'
    if (String(error.message || "").includes("INSUFFICIENT_CREDITS")) {
      const err: any = new Error("INSUFFICIENT_CREDITS");
      (err as any).code = 409;
      throw err;
    }
    throw new Error(error.message || "DB_ERROR");
  }

  // La función retorna table(remaining int). data suele ser array con un objeto { remaining: number }
  const remaining = Array.isArray(data) && data[0]?.remaining != null
    ? Number(data[0].remaining)
    : null;

  if (remaining == null || Number.isNaN(remaining)) {
    throw new Error("DB_INVALID_RESPONSE");
  }

  return remaining;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.userEmail || "").trim().toLowerCase();
    const amount = Number(body?.amount || 0);
    const reason = String(body?.reason || "evaluacion");
    const opId = body?.opId ? String(body.opId) : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount debe ser entero > 0" }, { status: 400 });
    }

    // Si hay Supabase: usa DB (atómico). Si no, usa memoria.
    let remaining: number | null = null;
    try {
      remaining = await consumeFromSupabase(email, amount, reason, opId);
    } catch (e: any) {
      if (e?.message === "INSUFFICIENT_CREDITS" || e?.code === 409) {
        return NextResponse.json({ error: "Saldo insuficiente" }, { status: 409 });
      }
      // si la DB falló por otra razón, intenta memoria para no bloquear test locales
      // (si prefieres fallar duro, elimina este fallback)
      remaining = null;
    }

    if (remaining == null) {
      try {
        const r = consumeFromMemory(email, amount, opId);
        return NextResponse.json({ ok: true, remaining: r }, { headers: { "Cache-Control": "no-store" } });
      } catch (e: any) {
        if (e?.message === "INSUFFICIENT_CREDITS") {
          return NextResponse.json({ error: "Saldo insuficiente" }, { status: 409 });
        }
        return NextResponse.json({ error: e?.message || "Error inesperado (mem)" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, remaining }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
