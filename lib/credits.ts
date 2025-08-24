import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Descuenta un crédito al usuario (elige el pack más antiguo con créditos vigentes).
 * Devuelve true si se descontó, false si no tenía créditos.
 */
export async function useOneCredit(userEmail: string): Promise<boolean> {
  const { data: rows, error } = await supabaseAdmin
    .from("user_credits")
    .select("*")
    .eq("user_email", userEmail)
    .gt("credits_remaining", 0)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  if (!rows || rows.length === 0) return false;

  const row = rows[0];

  const { error: updateError } = await supabaseAdmin
    .from("user_credits")
    .update({ credits_remaining: row.credits_remaining - 1 })
    .eq("id", row.id);

  if (updateError) throw updateError;

  return true;
}
