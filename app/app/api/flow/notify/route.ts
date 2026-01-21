import { NextRequest, NextResponse } from 'next/server'

// precios → créditos (ENV reales)
const PRICE_TO_CREDITS: Record<number, number> = {
  [Number(process.env.FLOW_PRICE_INTERMEDIO)]: Number(process.env.FLOW_CREDITS_INTERMEDIO), // 29990 -> 560
  [Number(process.env.FLOW_PRICE_PRO)]:        Number(process.env.FLOW_CREDITS_PRO),        // 49990 -> 1200
  [Number(process.env.FLOW_PRICE_400)]:        Number(process.env.FLOW_CREDITS_400),        // 12990 -> 400   <<< NUEVO
}

// TODO: reemplaza con tu DB real (idempotente)
async function sumarCreditosPorEmail(email: string, creditos: number, referencia: string) {
  // 1) Verifica si referencia ya existe (evita duplicar)
  // 2) Busca user por email
  // 3) user_credits.credits += creditos   // <<< CAMBIADO (antes decía balance)
  // 4) Guarda registro pago 'paid'
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.FLOW_NOTIFY_TOKEN) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const ct = req.headers.get('content-type') || ''
  let p: any = {}
  try {
    if (ct.includes('application/json')) {
      p = await req.json()
    } else {
      const form = await req.formData()
      form.forEach((v, k) => (p[k] = v))
    }
  } catch {
    return new NextResponse('bad payload', { status: 400 })
  }

  const status = String(p.status || p.payment_status || '').toLowerCase()
  if (!['paid', 'success', 'completed'].includes(status)) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const referencia = String(
    p.flowOrderId || p.order_id || p.commerceOrder || p.transaction_id || ''
  ).trim()

  // Monto (CLP). Si Flow llegara a enviar centavos en amount_cents, divídelo antes de comparar.
  const amountRaw = Number(p.amount || p.total || p.amount_cents || 0)
  const amountCLP = amountRaw > 1000 ? amountRaw : Math.round(amountRaw)

  const email = String(p.payer_email || p.email || '').trim()

  const creditos = PRICE_TO_CREDITS[amountCLP]
  if (!creditos) return new NextResponse('unknown amount', { status: 400 })

  await sumarCreditosPorEmail(email, creditos, referencia)
  return NextResponse.json({ ok: true })
}
