import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NOTIFICATION_TYPE = "overdue_checkout";
const DEFAULT_TITLE = "{{count}} overdue checkout(s)";
const DEFAULT_BODY =
  "Past their check-out date and still checked in: {{rooms}}. Check them out or extend the stay from the Bookings page.";

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] ?? m);

/**
 * Daily reminder for the front desk: finds checked-in bookings whose
 * check-out date has passed and refreshes one in-app notification per active
 * staff member (see the notification bell in the back-office sidebar).
 * Copy comes from the `overdue_checkout` notification template, editable and
 * toggleable at /admin/templates. Scheduled in vercel.json at 04:15 UTC
 * (10:00 in Kathmandu); the UTC and Nepal calendar dates match at that hour.
 */
export async function GET(request: NextRequest) {
  // Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; allow
  // either that or a `?secret=` query param so manual triggers also work.
  const fromHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  const fromQuery = request.nextUrl.searchParams.get("secret");
  const secret = fromHeader || fromQuery;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdueData, error: overdueErr } = await admin
    .from("bookings")
    .select("id, booking_code, guest_name, check_out, rooms:room_id(room_number)")
    .eq("status", "checked_in")
    .lt("check_out", today)
    .order("check_out");
  if (overdueErr) {
    return NextResponse.json({ error: overdueErr.message }, { status: 500 });
  }
  const overdue =
    (overdueData as unknown as
      | { id: string; booking_code: string; guest_name: string; check_out: string; rooms: { room_number: string } | null }[]
      | null) ?? [];

  // Yesterday's unread reminders are stale either way — a resolved overdue
  // must not keep ringing the bell, and a persisting one gets a fresh row
  // with today's counts. Read ones stay as history.
  const { error: clearErr } = await admin
    .from("notifications")
    .delete()
    .eq("type", NOTIFICATION_TYPE)
    .is("read_at", null);
  if (clearErr) {
    return NextResponse.json({ error: clearErr.message }, { status: 500 });
  }

  if (overdue.length === 0) {
    return NextResponse.json({ ok: true, overdue: 0, notified: 0, at: today });
  }

  const { data: tpl } = await admin
    .from("notification_templates")
    .select("title, body, is_active")
    .eq("key", NOTIFICATION_TYPE)
    .maybeSingle();
  const template = tpl as { title: string; body: string; is_active: boolean } | null;
  if (template && !template.is_active) {
    return NextResponse.json({ ok: true, overdue: overdue.length, notified: 0, skipped: "template inactive" });
  }

  const vars = {
    count: String(overdue.length),
    rooms: overdue
      .map((b) => `#${b.rooms?.room_number ?? "?"} ${b.guest_name} (due ${b.check_out})`)
      .join(", "),
  };
  const title = fill(template?.title ?? DEFAULT_TITLE, vars);
  const body = fill(template?.body ?? DEFAULT_BODY, vars);

  const { data: staffData, error: staffErr } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["receptionist", "manager", "super_admin"])
    .neq("is_active", false);
  if (staffErr) {
    return NextResponse.json({ error: staffErr.message }, { status: 500 });
  }
  const staff = (staffData as { id: string }[] | null) ?? [];

  if (staff.length > 0) {
    const rows = staff.map((p) => ({
      user_id: p.id,
      title,
      body,
      link: "/dashboard/bookings",
      type: NOTIFICATION_TYPE,
      data: { date: today, booking_ids: overdue.map((b) => b.id) },
    }));
    const { error: insertErr } = await admin.from("notifications").insert(rows);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, overdue: overdue.length, notified: staff.length, at: today });
}
