import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate, sendEmail } from "@/lib/email";

/** Escape the five HTML-significant characters so guest-supplied values
 * (e.g. guest_name from the public booking form) can't inject markup into the
 * HTML body. Applied only to the HTML render — subject/text stay literal. */
function escapeHtml(value: string | number | undefined): string | number | undefined {
  if (typeof value !== "string") return value;
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Send an email using a row from email_templates by key.
 * Reads via the admin client because email_templates RLS restricts SELECT
 * to super_admin, but transactional sends fire from server actions run by
 * guests/staff. Always best-effort — errors are logged but never thrown.
 */
export async function sendTemplatedEmail(
  key: string,
  to: string | string[],
  vars: Record<string, string | number | undefined>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_templates")
      .select("subject, body_html, body_text, is_active")
      .eq("key", key)
      .single();

    const t = data as {
      subject: string;
      body_html: string;
      body_text: string | null;
      is_active: boolean;
    } | null;
    if (!t || !t.is_active) {
      console.warn(`[email] template "${key}" not found or inactive`);
      return;
    }

    const htmlVars: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(vars)) htmlVars[k] = escapeHtml(v);

    await sendEmail({
      to,
      subject: renderTemplate(t.subject, vars),
      html: renderTemplate(t.body_html, htmlVars),
      text: t.body_text ? renderTemplate(t.body_text, vars) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] send "${key}" failed:`, msg);
  }
}
