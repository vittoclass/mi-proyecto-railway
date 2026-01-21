import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";

export async function getEmailFromRequest(): Promise<string | null> {
  try {
    const token = cookies().get("session")?.value;
    if (!token) return null;
    const payload = await verifySessionToken(token);
    return (payload.email || "").toLowerCase();
  } catch {
    return null;
  }
}
