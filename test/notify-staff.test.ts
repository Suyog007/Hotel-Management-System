import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./stubs/fake-supabase";

const h = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));

import { notifyStaff } from "@/lib/notify-staff";
import { fillNotificationTemplate, NOTIFICATION_TYPES } from "@/lib/notification-types";

function seed(opts: {
  profiles?: Record<string, unknown>[];
  templates?: Record<string, unknown>[];
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: opts.profiles ?? [
      { id: "staff-1", role: "receptionist", is_active: true },
      { id: "staff-2", role: "manager", is_active: true },
      { id: "staff-3", role: "super_admin", is_active: true },
      { id: "staff-4", role: "receptionist", is_active: false }, // deactivated
      { id: "guest-1", role: "guest", is_active: true }, // not staff
    ],
    notification_templates: opts.templates ?? [],
    notifications: [],
  };
  h.admin = createFakeSupabase(tables);
  return tables;
}

beforeEach(() => {
  h.admin = null;
});

describe("fillNotificationTemplate", () => {
  it("replaces known vars and leaves unknown ones visible", () => {
    expect(fillNotificationTemplate("Hi {{name}}, {{typo}}", { name: "Ana" })).toBe(
      "Hi Ana, {{typo}}",
    );
  });
});

describe("notifyStaff", () => {
  it("fans one row out per active staff member using registry defaults", async () => {
    const tables = seed({});
    const result = await notifyStaff({
      type: "staff_new_booking",
      vars: {
        guest_name: "Ana",
        booking_code: "BK-1",
        room_name: "Deluxe",
        check_in: "2026-09-04",
        check_out: "2026-09-06",
      },
      data: { booking_ids: ["b1"] },
    });

    expect(result).toMatchObject({ ok: true, notified: 3 });
    const rows = tables.notifications;
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.user_id))).toEqual(
      new Set(["staff-1", "staff-2", "staff-3"]),
    );
    expect(rows[0]).toMatchObject({
      title: "New booking: Ana",
      body: "Deluxe, 2026-09-04 → 2026-09-06 (BK-1).",
      type: "staff_new_booking",
      link: NOTIFICATION_TYPES.staff_new_booking.link,
      data: { booking_ids: ["b1"] },
    });
  });

  it("prefers the DB template row over the defaults", async () => {
    const tables = seed({
      templates: [
        {
          key: "staff_new_booking",
          title: "Custom: {{booking_code}}",
          body: "Custom body for {{guest_name}}",
          is_active: true,
        },
      ],
    });
    await notifyStaff({
      type: "staff_new_booking",
      vars: { guest_name: "Ana", booking_code: "BK-1" },
    });
    expect(tables.notifications[0]).toMatchObject({
      title: "Custom: BK-1",
      body: "Custom body for Ana",
    });
  });

  it("sends nothing when the template row is toggled off", async () => {
    const tables = seed({
      templates: [
        { key: "staff_cancellation", title: "t", body: "b", is_active: false },
      ],
    });
    const result = await notifyStaff({ type: "staff_cancellation", vars: {} });
    expect(result).toMatchObject({ ok: true, notified: 0, skipped: "template inactive" });
    expect(tables.notifications).toHaveLength(0);
  });

  it("handles an empty staff roster without inserting", async () => {
    const tables = seed({ profiles: [{ id: "guest-1", role: "guest" }] });
    const result = await notifyStaff({ type: "overdue_checkout", vars: { count: "1", rooms: "#101" } });
    expect(result).toMatchObject({ ok: true, notified: 0 });
    expect(tables.notifications).toHaveLength(0);
  });

  it("never throws — a broken admin client degrades to ok:false", async () => {
    h.admin = {
      from() {
        throw new Error("connection refused");
      },
    } as unknown as FakeSupabase;
    const result = await notifyStaff({ type: "staff_cancellation", vars: {} });
    expect(result).toMatchObject({ ok: false, notified: 0 });
    expect(result.error).toMatch(/connection refused/);
  });
});
