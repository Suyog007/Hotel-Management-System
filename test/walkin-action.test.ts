import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({
  server: null as unknown,
  admin: null as unknown,
  writeAudit: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));

import { createWalkInBooking } from "@/app/(staff)/dashboard/walk-in/actions";

const ROOM_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  const defaults = {
    room_type_id: ROOM_TYPE_ID,
    check_in: "2026-08-10",
    check_out: "2026-08-12",
    guests_count: "2",
    guest_name: "Walk In Guest",
    guest_email: "",
    guest_phone: "+9779800000001",
    payment_method: "pay_at_hotel",
    payment_status: "unpaid",
    payment_reference: "",
    initial_status: "confirmed",
    special_requests: "",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v);
  return fd;
}

function seed(opts: {
  actorRole?: string;
  user?: { id: string } | null;
  roomType?: Record<string, unknown> | null;
  rooms?: Record<string, unknown>[];
  existingProfile?: Record<string, unknown>;
}) {
  h.server = createFakeSupabase(
    { profiles: [{ id: ACTOR_ID, auth_user_id: "auth-1", role: opts.actorRole ?? "receptionist" }] },
    { user: opts.user === null ? null : { id: "auth-1" } },
  );
  const adminTables: Record<string, Record<string, unknown>[]> = {
    room_types:
      opts.roomType === null
        ? []
        : [{ id: ROOM_TYPE_ID, base_price: 2500, max_guests: 3, is_active: true, ...opts.roomType }],
    site_settings: [{ tax_rate: 0.1, service_charge_rate: 0.05 }],
    rooms: opts.rooms ?? [{ id: "room-1", type_id: ROOM_TYPE_ID, status: "available" }],
    bookings: [],
    payments: [],
    profiles: opts.existingProfile ? [opts.existingProfile] : [],
  };
  h.admin = createFakeSupabase(adminTables);
  return h.admin as ReturnType<typeof createFakeSupabase>;
}

beforeEach(() => {
  h.writeAudit.mockReset();
});

describe("createWalkInBooking", () => {
  it("redirects to /login when there is no session", async () => {
    seed({ user: null });
    const url = await expectRedirectTo(() => createWalkInBooking(form({})));
    expect(url).toBe("/login?next=/dashboard/walk-in");
  });

  it("bails for a non-staff actor", async () => {
    seed({ actorRole: "guest" });
    const url = await expectRedirectTo(() => createWalkInBooking(form({})));
    expect(url).toMatch(/^\/dashboard\/walk-in\?error=/);
  });

  it("bails on invalid form input", async () => {
    seed({});
    const url = await expectRedirectTo(() => createWalkInBooking(form({ check_out: "2026-08-05" })));
    expect(url).toMatch(/^\/dashboard\/walk-in\?error=/);
  });

  it("bails when the room type doesn't exist or is inactive", async () => {
    seed({ roomType: null });
    const url = await expectRedirectTo(() => createWalkInBooking(form({})));
    expect(url).toMatch(/Room%20type%20not%20available/);
  });

  it("bails when guests_count exceeds the room type's max_guests", async () => {
    seed({ roomType: { max_guests: 1 } });
    const url = await expectRedirectTo(() => createWalkInBooking(form({ guests_count: "2" })));
    expect(url).toMatch(/Max%201%20guests/);
  });

  it("bails when no room of that type is available", async () => {
    seed({ rooms: [] });
    const url = await expectRedirectTo(() => createWalkInBooking(form({})));
    expect(url).toMatch(/No%20rooms%20available/);
  });

  it("bails when every room of that type is under maintenance", async () => {
    seed({ rooms: [{ id: "room-1", type_id: ROOM_TYPE_ID, status: "maintenance" }] });
    const url = await expectRedirectTo(() => createWalkInBooking(form({})));
    expect(url).toMatch(/No%20rooms%20available/);
  });

  it("creates a confirmed unpaid booking, a new stub guest profile, and redirects to the booking page", async () => {
    const admin = seed({});
    const url = await expectRedirectTo(() => createWalkInBooking(form({})));

    expect(url).toMatch(/^\/booking\/[0-9a-f-]+$/);
    expect(admin.__tables.bookings).toHaveLength(1);
    expect(admin.__tables.bookings[0]).toMatchObject({
      status: "confirmed",
      payment_status: "unpaid",
      paid_amount: 0,
      verification_method: "staff_call",
      verified_by: ACTOR_ID,
    });
    expect(admin.__tables.profiles).toHaveLength(1);
    expect(admin.__tables.payments).toHaveLength(0);
    expect(h.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "create", entityType: "bookings" }));
  });

  it("records a payments row when payment_status is paid", async () => {
    const admin = seed({});
    await expectRedirectTo(() =>
      createWalkInBooking(form({ payment_status: "paid", payment_reference: "cash-1" })),
    );
    expect(admin.__tables.bookings[0]).toMatchObject({ payment_status: "paid" });
    expect(admin.__tables.payments).toHaveLength(1);
    expect(admin.__tables.payments[0]).toMatchObject({ status: "paid", transaction_id: "cash-1" });
  });

  it("flips the room to occupied and stamps checked_in_at when initial_status is checked_in", async () => {
    const admin = seed({});
    await expectRedirectTo(() => createWalkInBooking(form({ initial_status: "checked_in" })));
    expect(admin.__tables.bookings[0]).toMatchObject({ status: "checked_in" });
    expect(admin.__tables.bookings[0].checked_in_at).toBeTruthy();
    expect(admin.__tables.rooms[0]).toMatchObject({ status: "occupied" });
  });

  it("reuses an existing guest profile matched by email instead of creating a duplicate", async () => {
    const admin = seed({ existingProfile: { id: "existing-guest", email: "walkin@x.com" } });
    await expectRedirectTo(() => createWalkInBooking(form({ guest_email: "walkin@x.com" })));
    expect(admin.__tables.profiles).toHaveLength(1);
    expect(admin.__tables.bookings[0]).toMatchObject({ guest_id: "existing-guest" });
  });

  it("synthesizes a placeholder guest_email when none is supplied", async () => {
    const admin = seed({});
    await expectRedirectTo(() => createWalkInBooking(form({})));
    expect(admin.__tables.bookings[0].guest_email).toMatch(/^walkin-.+@example\.invalid$/);
  });
});
