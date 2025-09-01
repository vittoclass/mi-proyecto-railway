import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Descuenta exactamente 1 crédito del pack MÁS ANTIGUO vigente del usuario.
 * Devuelve true si se descontó, false si no había créditos disponibles.
 *
 * NOTA: Asume columnas:
 * - user_credits.email (text/varchar)
 * - user_credits.credits_remaining (int)
 * - user_credits.expires_at (timestamptz)
 */
export async function useOneCredit(userEmail: string): Promise<boolean> {
  try {
    // 1) Buscar el pack vigente más antiguo con saldo
    const nowIso = new Date().toISOString();

    const { data: rows, error: selectError } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("email", userEmail)                 // ⬅️ antes: user_email
      .gt("credits_remaining", 0)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: true })
      .limit(1);

    if (selectError) throw selectError;
    if (!rows || rows.length === 0) return false;

    const row = rows[0];

    // 2) Descontar 1 (en ese registro)
    const newCredits = (row.credits_remaining as number) - 1;
    if (newCredits < 0) return false; // guarda extra

    const { error: updateError } = await supabaseAdmin
      .from("user_credits")
      .update({ credits_remaining: newCredits })
      .eq("id", row.id);

    if (updateError) throw updateError;

    return true;
  } catch (e: any) {
    // Deja un error claro en logs para depurar rápido
    console.error("useOneCredit() error:", e?.message || e);
    throw new Error(
      e?.message?.includes("user_credits.user_email")
        ? "Tu tabla user_credits no tiene la columna 'user_email'. Usa 'email'."
        : e?.message || "Error desconocido en useOneCredit"
    );
  }
}
