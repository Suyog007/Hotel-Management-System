import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, makeCookieJar, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({
  admin: null as unknown,
  cookieJar: null as unknown,
  writeAudit: vi.fn(),
  sendTemplatedEmail: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/headers", () => ({ cookies: async () => h.cookieJar }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));
vi.mock("@/lib/email-from-template", () => ({ sendTemplatedEmail: h.sendTemplatedEmail }));

import { verifyAndCreateBooking } from "@/app/booking/verify/actions";
import { sign } from "@/lib/signed-cookie";

const secret = process.env.SESSION_COOKIE_SECRET as string;
const hashOf = (code: string) => crypto.createHmac("sha256", secret).update(code).digest("hex");
const future = () => new Date(Date.now() + 3_600_000).toISOString();

const ROOM_ID = "11111111-1111-1111-1111-111111111111";
const ROOM_TYPE_ID = "22222222-2222-2222-2222-222222222222";

function baseIntent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    room_id: ROOM_ID,
    room_type_id: ROOM_TYPE_ID,
    check_in: "2026-08-01",
    check_out: "2026-08-03",
    guests_count: 2,
    guest_name: "Ada Lovelace",
    guest_email: "ada@example.com",
    guest_phone: "+9779800000000",
    payment_method: "pay_at_hotel",
    subtotal: 5000,
    tax_amount: 500,
    service_amount: 250,
    total_amount: 5750,
    expires_at: Date.now() + 10 * 60 * 1000,
    ...overrides,
  };
}

function setCookie(intent: ReturnType<typeof baseIntent> | null) {
  h.cookieJar = makeCookieJar(intent ? { booking_intent: sign(intent) } : {});
}

function formWithToken(token: string) {
  const fd = new FormData();
  fd.set("token", token);
  return fd;
}

function seedAdmin(opts: {
  otp?: Record<string, unknown>;
  existingProfile?: Record<string, unknown>;
  overlappingBooking?: boolean;
} = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    otp_verifications: opts.otp ? [opts.otp] : [],
    profiles: opts.existingProfile ? [opts.existingProfile] : [],
    bookings: opts.overlappingBooking
      ? [
          {
            room_id: ROOM_ID,
            status: "confirmed",
            check_in: "2026-08-01",
            check_out: "2026-08-03",
          },
        ]
      : [],
    room_types: [{ id: ROOM_TYPE_ID, name: "Deluxe" }],
    site_settings: [{ currency_symbol: "Rs.", google_place_uri: null }],
  };
  h.admin = createFakeSupabase(tables);
  return h.admin as ReturnType<typeof createFakeSupabase>;
}

beforeEach(() => {
  h.writeAudit.mockReset();
  h.sendTemplatedEmail.mockReset();
  process.env.NEXT_PUBLIC_SITE_URL = "https://grandstay.example";
});

describe("verifyAndCreateBooking", () => {
  it("redirects to /rooms when there is no (or an expired) booking intent cookie", async () => {
    setCookie(null);
    seedAdmin();
    const url = await expectRedirectTo(() => verifyAndCreateBooking(formWithToken("123456")));
    expect(url).toMatch(/^\/rooms\?error=/);
  });

  it("redirects back to /booking/verify when the code isn't 6 digits", async () => {
    setCookie(baseIntent());
    seedAdmin();
    const url = await expectRedirectTo(() => verifyAndCreateBooking(formWithToken("12a456")));
    expect(url).toMatch(/^\/booking\/verify\?/);
  });

  it("redirects back to /booking/verify with an error when the OTP is wrong", async () => {
    setCookie(baseIntent());
    seedAdmin({ otp: { email: "ada@example.com", code_hash: hashOf("111111"), expires_at: future(), attempts: 0, purpose: "booking", consumed_at: null } });
    const url = await expectRedirectTo(() => verifyAndCreateBooking(formWithToken("999999")));
    expect(url).toMatch(/^\/booking\/verify\?email=ada%40example\.com&error=/);
  });

  it("deletes the intent cookie and redirects to /rooms when the room was taken during the OTP window", async () => {
    setCookie(baseIntent());
    const admin = seedAdmin({
      otp: { email: "ada@example.com", code_hash: hashOf("424242"), expires_at: future(), attempts: 0, purpose: "booking", consumed_at: null },
      overlappingBooking: true,
    });
    void admin;
    const url = await expectRedirectTo(() => verifyAndCreateBooking(formWithToken("424242")));
    expect(url).toMatch(/^\/rooms\?error=/);
    expect((h.cookieJar as ReturnType<typeof makeCookieJar>).get("booking_intent")).toBeUndefined();
  });

  it("creates a booking + new stub profile, writes an audit log, sends the confirmation email, and redirects to the booking page", async () => {
    setCookie(baseIntent());
    const admin = seedAdmin({
      otp: { email: "ada@example.com", code_hash: hashOf("424242"), expires_at: future(), attempts: 0, purpose: "booking", consumed_at: null },
    });

    const url = await expectRedirectTo(() => verifyAndCreateBooking(formWithToken("424242")));

    expect(url).toMatch(/^\/booking\/[0-9a-f-]+\?t=/);
    expect(url).not.toMatch(/pay=pending/);

    const bookings = admin.__tables.bookings;
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({
      guest_email: "ada@example.com",
      status: "confirmed", // pay_at_hotel
      payment_status: "unpaid",
      total_amount: 5750,
    });

    const profiles = admin.__tables.profiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ email: "ada@example.com", is_stub: true, role: "guest" });

    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "bookings" }),
    );
    expect(h.sendTemplatedEmail).toHaveBeenCalledWith(
      "booking_confirmation",
      "ada@example.com",
      expect.objectContaining({ guest_name: "Ada Lovelace" }),
    );
    expect((h.cookieJar as ReturnType<typeof makeCookieJar>).get("booking_intent")).toBeUndefined();
  });

  it("reuses an existing profile by email instead of creating a duplicate, backfilling only missing fields", async () => {
    setCookie(baseIntent());
    const admin = seedAdmin({
      otp: { email: "ada@example.com", code_hash: hashOf("424242"), expires_at: future(), attempts: 0, purpose: "booking", consumed_at: null },
      existingProfile: { id: "profile-existing", email: "ada@example.com", phone: "+9779811111111", full_name: null },
    });

    await expectRedirectTo(() => verifyAndCreateBooking(formWithToken("424242")));

    expect(admin.__tables.profiles).toHaveLength(1); // no duplicate created
    expect(admin.__tables.profiles[0]).toMatchObject({
      id: "profile-existing",
      phone: "+9779811111111", // untouched, was already set
      full_name: "Ada Lovelace", // backfilled, was null
    });
    expect(admin.__tables.bookings[0]).toMatchObject({ guest_id: "profile-existing" });
  });
});
