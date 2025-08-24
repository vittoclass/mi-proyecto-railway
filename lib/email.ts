import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.RESEND_FROM || "Libel-IA <onboarding@resend.dev>";

  if (!process.env.RESEND_API_KEY) {
    throw new Error("Falta RESEND_API_KEY en las variables de entorno");
  }

  const data = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  return data;
}
