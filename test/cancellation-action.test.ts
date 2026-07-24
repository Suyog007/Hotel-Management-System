import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({
  server: null as unknown,
  writeAudit: vi.fn(),
  sendTemplatedEmail: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));
vi.mock("@/lib/email-from-template", () => ({ sendTemplatedEmail: h.sendTemplatedEmail }));

import { recordRefund } from "@/app/(staff)/dashboard/cancellations/actions";

const BOOKING_ID = "11111111-1111-1111-1111-111111111111";
const PROFILE_ID = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  fd.set("notes", "");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function seed(opts: {
  role?: string;
  booking?: Record<string, unknown>;
  user?: { id: string } | null;
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [{ id: PROFILE_ID, auth_user_id: "auth-1", role: opts.role ?? "manager" }],
    bookings: opts.booking ? [{ id: BOOKING_ID, ...opts.booking }] : [],
    site_settings: [{ currency_symbol: "Rs." }],
  };
  h.server = createFakeSupabase(tables, { user: opts.user === null ? null : { id: "auth-1" } });
  return h.server as ReturnType<typeof createFakeSupabase>;
}

beforeEach(() => {
  h.writeAudit.mockReset();
  h.sendTemplatedEmail.mockReset();
});

describe("recordRefund", () => {
  it("redirects to /login when there is no session", async () => {
    seed({ user: null, booking: { status: "cancelled", total_amount: 1000, refunded_at: null } });
    const url = await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "500", refund_reference: "REF1" })),
    );
    expect(url).toBe("/login?next=/dashboard/cancellations");
  });

  it("rejects a non-manager (receptionist) actor", async () => {
    seed({ role: "receptionist", booking: { status: "cancelled", total_amount: 1000, refunded_at: null } });
    const url = await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "500", refund_reference: "REF1" })),
    );
    expect(url).toMatch(/^\/dashboard\/cancellations\?error=Manager/);
  });

  it("rejects a booking that isn't cancelled", async () => {
    seed({ booking: { status: "confirmed", total_amount: 1000, refunded_at: null } });
    const url = await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "500", refund_reference: "REF1" })),
    );
    expect(url).toMatch(/not%20cancelled/);
  });

  it("rejects a booking that already has a refund recorded", async () => {
    seed({ booking: { status: "cancelled", total_amount: 1000, refunded_at: "2026-01-01T00:00:00Z" } });
    const url = await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "500", refund_reference: "REF1" })),
    );
    expect(url).toMatch(/already%20recorded/);
  });

  it("marks payment_status 'refunded' when the refund covers the full total", async () => {
    const server = seed({ booking: { status: "cancelled", total_amount: 1000, refunded_at: null, guest_email: "g@x.com", guest_name: "G", booking_code: "BK1" } });
    await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "1000", refund_reference: "REF1" })),
    );
    expect(server.__tables.bookings[0]).toMatchObject({ payment_status: "refunded", refunded_amount: 1000 });
  });

  it("marks payment_status 'partially_refunded' for a partial refund", async () => {
    const server = seed({ booking: { status: "cancelled", total_amount: 1000, refunded_at: null, guest_email: "g@x.com" } });
    await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "400", refund_reference: "REF1" })),
    );
    expect(server.__tables.bookings[0]).toMatchObject({ payment_status: "partially_refunded" });
  });

  it("leaves payment_status untouched for a zero-amount refund (denied case)", async () => {
    const server = seed({ booking: { status: "cancelled", total_amount: 1000, refunded_at: null, payment_status: "unpaid", guest_email: "g@x.com" } });
    await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "0", refund_reference: "denied" })),
    );
    expect(server.__tables.bookings[0]).toMatchObject({ payment_status: "unpaid" });
  });

  it("writes an audit log and sends the refund email, then redirects with saved=1", async () => {
    seed({ booking: { status: "cancelled", total_amount: 1000, refunded_at: null, guest_email: "g@x.com", guest_name: "G", booking_code: "BK1" } });
    const url = await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "1000", refund_reference: "REF1" })),
    );
    expect(url).toBe("/dashboard/cancellations?saved=1");
    expect(h.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "refund_recorded", entityId: BOOKING_ID }));
    expect(h.sendTemplatedEmail).toHaveBeenCalledWith(
      "booking_refunded",
      "g@x.com",
      expect.objectContaining({ refund_reference: "REF1" }),
    );
  });

  it("rejects invalid form input (missing refund_reference) before touching the DB", async () => {
    const server = seed({ booking: { status: "cancelled", total_amount: 1000, refunded_at: null } });
    const url = await expectRedirectTo(() =>
      recordRefund(form({ id: BOOKING_ID, refunded_amount: "100", refund_reference: "" })),
    );
    expect(url).toMatch(/^\/dashboard\/cancellations\?error=/);
    expect(server.__tables.bookings[0]).toMatchObject({ refunded_at: null });
  });
});
