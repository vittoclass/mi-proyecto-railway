import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const FLOW_API_KEY = process.env.FLOW_API_KEY ? "OK" : "MISSING";
  const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY ? "OK" : "MISSING";
  const FLOW_ENV = (process.env.FLOW_ENV || "sandbox").toLowerCase();
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "(empty)";
  const host = FLOW_ENV === "prod" ? "https://www.flow.cl" : "https://sandbox.flow.cl";
  return NextResponse.json({
    ok: true,
    env: { FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_ENV, BASE_URL, host }
  });
}
