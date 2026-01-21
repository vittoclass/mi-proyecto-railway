import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY || "";
const fromDefault = process.env.RESEND_FROM || "Libel-IA <onboarding@resend.dev>";

if (!apiKey) {
  console.warn("⚠️ Falta RESEND_API_KEY en variables de entorno");
}

const resend = new Resend(apiKey);

/**
 * sendEmail({to, subject, html, text?, from?})
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}) {
  const safeFrom = from || fromDefault;
  try {
    const result = await resend.emails.send({
      from: safeFrom,
      to: [to],
      subject,
      html,
      text: text || stripHtmlToText(html),
    });
    // Opcional: log de Resend id para debug
    if ((result as any)?.id) {
      console.log("✉️ Resend email id:", (result as any).id);
    }
    return { ok: true };
  } catch (e: any) {
    console.error("❌ Error enviando email con Resend:", e?.message || e);
    return { ok: false, error: e?.message || "Email error" };
  }
}

function stripHtmlToText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
