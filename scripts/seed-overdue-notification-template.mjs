/**
 * Seeds the `overdue_checkout` notification template used by the
 * /api/cron/overdue-checkouts reminder. Idempotent — an existing row is left
 * untouched so admin edits made at /admin/templates survive re-runs.
 *
 *   node scripts/seed-overdue-notification-template.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const { data: existing } = await db
  .from("notification_templates")
  .select("key")
  .eq("key", "overdue_checkout")
  .maybeSingle();

if (existing) {
  console.log("Template 'overdue_checkout' already exists — nothing to do.");
  process.exit(0);
}

const { error } = await db.from("notification_templates").insert({
  key: "overdue_checkout",
  title: "{{count}} overdue checkout(s)",
  body: "Past their check-out date and still checked in: {{rooms}}. Check them out or extend the stay from the Bookings page.",
  variables: ["count", "rooms"],
  is_active: true,
});
if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}
console.log("Template 'overdue_checkout' created — editable at /admin/templates.");
