export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Nota: aquí podrías validar firma HMAC de Khipu (seguridad avanzada).
 * Para empezar, haremos validaciones básicas y estado === 'done'.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const khipuStatus = body.status;              // "done"
    const orderId = body.transaction_id;          // id de orders
    const subject = body.subject;                 // "Compra plan XXX"

    if (!orderId) return NextResponse.json({ ok: false, error: "Sin transaction_id" }, { status: 400 });

    // 1) Trae la orden
    const { data: order, error: oe } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (oe || !order) return NextResponse.json({ ok: false, error: "Orden no encontrada" }, { status: 404 });

    // 2) Si ya está pagada, no repitas (idempotencia)
    if (order.status === "paid") return NextResponse.json({ ok: true, msg: "Ya pagada" });

    if (khipuStatus === "done") {
      // 3) Buscar plan para saber créditos
      const { data: plan, error: pe } = await supabase.from("plans").select("*").eq("id", order.plan_id).maybeSingle();
      if (pe || !plan) return NextResponse.json({ ok: false, error: "Plan no encontrado" }, { status: 404 });

      // 4) Acreditar créditos
      await supabase.from("user_credits").insert({
        user_email: order.user_email,
        credits_added: plan.credits,
        motivo: `Compra plan ${plan.id}`,
      });

      // 5) Marcar orden como pagada
      await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);

      return NextResponse.json({ ok: true });
    }

    // otros estados: cancel / failed → refleja en orden
    await supabase.from("orders").update({ status: khipuStatus }).eq("id", order.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
