import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userEmail } = await req.json();
    const email = String(userEmail || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    }

    // TODO: lógica real con DB para evitar reuso del free
    const alreadyUsed = false; // ajusta cuando conectes BD
    if (alreadyUsed) {
      return NextResponse.json({ ok: true, creditsGranted: 0 });
    }

    const creditsGranted = 10; // ← GRATIS = 10
    // TODO: acreditar en DB

    return NextResponse.json({ ok: true, creditsGranted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
