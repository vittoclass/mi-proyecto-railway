import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "(vacío)",
    KHIPU_RECEIVER_ID: process.env.KHIPU_RECEIVER_ID ? "OK" : "FALTA",
    KHIPU_SECRET: process.env.KHIPU_SECRET ? "OK" : "FALTA",
  });
}
