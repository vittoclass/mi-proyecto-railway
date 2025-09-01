// lib/credits.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Resta 1 crédito en la fila de `user_credits` del usuario. */
export async function useOneCredit(email: string): Promise<boolean> {
  const { data: row, error } = await supabaseAdmin
    .from("user_credits")
    .select("id, credits")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  const credits = Number(row?.credits ?? 0);
  if (!row || credits <= 0) return false;

  const { error: updErr } = await supabaseAdmin
    .from("user_credits")
    .update({ credits: credits - 1 })
    .eq("id", row.id);

  if (updErr) throw updErr;
  return true;
}
