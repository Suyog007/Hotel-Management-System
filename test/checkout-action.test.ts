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

import { checkOut } from "@/app/(staff)/dashboard/bookings/actions";

const BOOKING_ID = "11111111-1111-1111-1111-111111111111";
const ROOM_ID = "22222222-2222-2222-2222-222222222222";
const STAFF_ID = "33333333-3333-3333-3333-333333333333";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  fd.set("id", BOOKING_ID);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function seed(booking: Record<string, unknown> = {}) {
  // One shared table map for both clients: the action reads the booking via
  // the RLS server client and writes via the admin client.
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [{ id: STAFF_ID, auth_user_id: "auth-1", role: "receptionist", is_active: true }],
    bookings: [
      {
        id: BOOKING_ID,
        status: "checked_in",
        room_id: ROOM_ID,
        booking_code: "BK-1",
        guest_email: "g@x.com",
        guest_name: "Guest",
        total_amount: 1200,
        paid_amount: 0,
        payment_status: "unpaid",
        payment_method: "pay_at_hotel",
        ...booking,
      },
    ],
    rooms: [{ id: ROOM_ID, status: "occupied" }],
    payments: [],
  };
  h.server = createFakeSupabase(tables, { user: { id: "auth-1" } });
  h.admin = createFakeSupabase(tables, { user: { id: "auth-1" } });
  return tables;
}

beforeEach(() => {
  h.writeAudit.mockReset();
});

describe("checkOut with payment collection", () => {
  it("collect=1 settles the balance: booking paid, payments row written, room to cleaning", async () => {
    const tables = seed();
    const url = await expectRedirectTo(() =>
      checkOut(form({ collect: "1", payment_provider: "khalti", payment_reference: "TXN-9" })),
    );
    expect(url).toBe("/dashboard/bookings?saved=1&collected=1200");

    expect(tables.bookings[0]).toMatchObject({
      status: "checked_out",
      payment_status: "paid",
      paid_amount: 1200,
    });
    expect(tables.payments).toHaveLength(1);
    expect(tables.payments[0]).toMatchObject({
      booking_id: BOOKING_ID,
      amount: 1200,
      method: "pay_at_hotel",
      provider: "khalti",
      transaction_id: "TXN-9",
      status: "paid",
    });
    expect(tables.rooms[0]).toMatchObject({ status: "cleaning" });
    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: expect.objectContaining({ payment_status: "paid", collected: 1200 }),
      }),
    );
  });

  it("collects only the outstanding remainder of a partially paid booking", async () => {
    const tables = seed({ paid_amount: 500 });
    const url = await expectRedirectTo(() => checkOut(form({ collect: "1" })));
    expect(url).toBe("/dashboard/bookings?saved=1&collected=700");
    expect(tables.bookings[0]).toMatchObject({ paid_amount: 1200, payment_status: "paid" });
    expect(tables.payments[0]).toMatchObject({ amount: 700, provider: "cash" });
  });

  it("without collect, checks out but leaves payment untouched", async () => {
    const tables = seed();
    const url = await expectRedirectTo(() => checkOut(form({})));
    expect(url).toBe("/dashboard/bookings?saved=1");
    expect(tables.bookings[0]).toMatchObject({
      status: "checked_out",
      payment_status: "unpaid",
      paid_amount: 0,
    });
    expect(tables.payments).toHaveLength(0);
  });

  it("collect on an already-settled booking writes no duplicate payment", async () => {
    const tables = seed({ paid_amount: 1200, payment_status: "paid" });
    const url = await expectRedirectTo(() => checkOut(form({ collect: "1" })));
    expect(url).toBe("/dashboard/bookings?saved=1");
    expect(tables.payments).toHaveLength(0);
    expect(tables.bookings[0]).toMatchObject({ status: "checked_out", payment_status: "paid" });
  });

  it("rejects an unknown payment provider when collecting", async () => {
    const tables = seed();
    const url = await expectRedirectTo(() =>
      checkOut(form({ collect: "1", payment_provider: "paypal" })),
    );
    expect(url).toMatch(/error=Pick%20a%20valid%20payment%20method/);
    expect(tables.bookings[0]).toMatchObject({ status: "checked_in" });
    expect(tables.payments).toHaveLength(0);
  });

  it("still refuses to check out a booking that isn't checked in", async () => {
    const tables = seed({ status: "confirmed" });
    const url = await expectRedirectTo(() => checkOut(form({ collect: "1" })));
    expect(url).toMatch(/error=Cannot/);
    expect(tables.payments).toHaveLength(0);
  });

  it("returns to a dashboard redirect_to path when supplied", async () => {
    seed();
    const detail = `/dashboard/bookings/${BOOKING_ID}`;
    const url = await expectRedirectTo(() =>
      checkOut(form({ collect: "1", redirect_to: detail })),
    );
    expect(url).toBe(`${detail}?saved=1&collected=1200`);
  });

  it("ignores an off-site redirect_to and falls back to the bookings list", async () => {
    seed();
    const url = await expectRedirectTo(() =>
      checkOut(form({ redirect_to: "https://evil.example/steal" })),
    );
    expect(url).toBe("/dashboard/bookings?saved=1");
  });
});
