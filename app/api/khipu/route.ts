import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  // Aquí luego validas el webhook real de Khipu
  return NextResponse.json({
    ok: true,
    webhook: body,
    mensaje: "Webhook recibido 🚀"
  });
}
