import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import {
  NOTIFICATION_TYPES,
  fillNotificationTemplate,
  type NotificationTypeKey,
} from "@/lib/notification-types";

const STAFF_ROLES = ["receptionist", "manager", "super_admin"] as const;

export type NotifyStaffResult = {
  ok: boolean;
  /** How many staff members received a row. */
  notified: number;
  /** Set when the send was intentionally not performed (e.g. template off). */
  skipped?: string;
  error?: string;
};

/**
 * Fan one in-app notification out to every active staff member (rows in
 * `notifications`, surfaced by the back-office bell). Copy comes from the
 * type's `notification_templates` row when present + active, else from the
 * defaults in `lib/notification-types.ts`.
 *
 * Best-effort by design: never throws, so booking/cancellation actions can
 * call it without risking the transaction the guest actually cares about.
 * Callers that need the outcome (the cron) read the returned result.
 */
export async function notifyStaff(args: {
  type: NotificationTypeKey;
  vars: Record<string, string>;
  /** Override the registry link (e.g. deep-link to one booking). */
  link?: string;
  /** Extra machine-readable payload stored on the row. */
  data?: Record<string, unknown>;
}): Promise<NotifyStaffResult> {
  try {
    const def = NOTIFICATION_TYPES[args.type];
    const admin = createAdminClient();

    const { data: tpl, error: tplErr } = await admin
      .from("notification_templates")
      .select("title, body, is_active")
      .eq("key", def.key)
      .maybeSingle();
    if (tplErr) {
      // Template read failing is no reason to drop the notification — the
      // registry defaults exist exactly for this.
      console.error(`[notify] template read "${def.key}" failed:`, tplErr.message);
    }
    const template = tpl as { title: string; body: string; is_active: boolean } | null;
    if (template && !template.is_active) {
      return { ok: true, notified: 0, skipped: "template inactive" };
    }

    const title = fillNotificationTemplate(template?.title ?? def.defaultTitle, args.vars);
    const body = fillNotificationTemplate(template?.body ?? def.defaultBody, args.vars);

    const { data: staffData, error: staffErr } = await admin
      .from("profiles")
      .select("id")
      .in("role", [...STAFF_ROLES])
      .neq("is_active", false);
    if (staffErr) {
      console.error(`[notify] staff lookup for "${def.key}" failed:`, staffErr.message);
      return { ok: false, notified: 0, error: staffErr.message };
    }
    const staff = (staffData as { id: string }[] | null) ?? [];
    if (staff.length === 0) return { ok: true, notified: 0 };

    const rows = staff.map((p) => ({
      user_id: p.id,
      title,
      body,
      link: args.link ?? def.link,
      type: args.type,
      data: ((args.data ?? {}) as Json),
    }));
    const { error: insertErr } = await admin.from("notifications").insert(rows);
    if (insertErr) {
      console.error(`[notify] insert for "${def.key}" failed:`, insertErr.message);
      return { ok: false, notified: 0, error: insertErr.message };
    }
    return { ok: true, notified: staff.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notify] "${args.type}" failed:`, msg);
    return { ok: false, notified: 0, error: msg };
  }
}
