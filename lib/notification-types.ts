/**
 * Registry of every in-app notification type the code actually sends.
 *
 * Single source of truth shared by:
 *  - `lib/notify-staff.ts` (fills copy + fans rows out to staff)
 *  - `/admin/templates` (renders exactly these keys, no dead entries)
 *  - `supabase/migrations/0017_notification_templates.sql` (seeds the rows)
 *
 * The `notification_templates` DB row for a key overrides the defaults here;
 * when the row is missing (migration not applied yet) the defaults keep the
 * notification working instead of silently dropping it.
 */
export type NotificationTypeDef = {
  /** Where the admin-facing copy lives: notification_templates.key */
  key: string;
  /** Shown on /admin/templates so the editor knows when this fires. */
  description: string;
  defaultTitle: string;
  defaultBody: string;
  variables: string[];
  /** Where clicking the bell entry lands. */
  link: string;
};

export const NOTIFICATION_TYPES = {
  staff_new_booking: {
    key: "staff_new_booking",
    description:
      "Sent to every active staff member the moment a booking is created — online (OTP-verified) or via the walk-in form.",
    defaultTitle: "New booking: {{guest_name}}",
    defaultBody:
      "{{room_name}}, {{check_in}} → {{check_out}} ({{booking_code}}).",
    variables: ["guest_name", "booking_code", "room_name", "check_in", "check_out"],
    link: "/dashboard/bookings",
  },
  staff_cancellation: {
    key: "staff_cancellation",
    description:
      "Sent to every active staff member when a booking is cancelled (by the guest or by staff).",
    defaultTitle: "Cancelled: {{booking_code}}",
    defaultBody:
      "{{guest_name}} — stay starting {{check_in}}. Refund due: {{refund_amount_due}}.",
    variables: ["guest_name", "booking_code", "check_in", "refund_amount_due"],
    link: "/dashboard/cancellations",
  },
  overdue_checkout: {
    key: "overdue_checkout",
    description:
      "Daily front-desk reminder (04:15 UTC cron) listing checked-in bookings past their check-out date.",
    defaultTitle: "{{count}} overdue checkout(s)",
    defaultBody:
      "Past their check-out date and still checked in: {{rooms}}. Check them out or extend the stay from the Bookings page.",
    variables: ["count", "rooms"],
    link: "/dashboard/bookings",
  },
} as const satisfies Record<string, NotificationTypeDef>;

export type NotificationTypeKey = keyof typeof NOTIFICATION_TYPES;

/** Replace `{{key}}` placeholders; unknown keys are left visible on purpose so
 * an admin can spot a typo'd variable in the rendered notification. */
export function fillNotificationTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}
