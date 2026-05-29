import "server-only";
import nodemailer from "nodemailer";

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send a transactional email via Gmail SMTP (nodemailer).
 *
 * Requires `GMAIL_USER` + `GMAIL_APP_PASSWORD` (the App Password, not your
 * normal Gmail password). Generate at https://myaccount.google.com/apppasswords
 * with 2-Step Verification enabled. Soft cap ~500/day. Sends to anyone.
 *
 * If `GMAIL_APP_PASSWORD` is unset, the send is logged and no-op'd so dev
 * environments without email configured still work.
 */
export async function sendEmail(args: SendEmailArgs) {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn(
      "[email] GMAIL_APP_PASSWORD not set — skipping send",
      { to: args.to, subject: args.subject },
    );
    return { id: null, skipped: true as const };
  }

  const transport = getGmailTransport();
  const fromName = process.env.GMAIL_FROM_NAME ?? "Hotel Vardani";
  const fromEmail = process.env.GMAIL_USER!;
  const info = await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: Array.isArray(args.to) ? args.to.join(",") : args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  return { id: info.messageId ?? null, skipped: false as const };
}

let gmailTransport: nodemailer.Transporter | null = null;
function getGmailTransport() {
  if (gmailTransport) return gmailTransport;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_APP_PASSWORD is set but GMAIL_USER is not — set GMAIL_USER to the same Gmail address that owns the App Password.",
    );
  }
  gmailTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
  });
  return gmailTransport;
}

/**
 * Replace `{{key}}` placeholders in a template body/subject with values.
 * Missing keys are left untouched so an admin can spot them in the rendered
 * output. HTML-escaping is the caller's job — templates ship trusted markup.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>,
) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}
