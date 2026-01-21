import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const FLOW_ENV = (process.env.FLOW_ENV || "sandbox").toLowerCase();
  const host = FLOW_ENV === "prod" ? "https://www.flow.cl" : "https://sandbox.flow.cl";
  return NextResponse.json({
    ok: true,
    env: {
      FLOW_API_KEY: process.env.FLOW_API_KEY ? "OK" : "MISSING",
      FLOW_SECRET_KEY: process.env.FLOW_SECRET_KEY ? "OK" : "MISSING",
      FLOW_ENV,
      BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "(empty)",
      host
    }
  });
}
