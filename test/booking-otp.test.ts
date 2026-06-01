import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";

// Swap the service-role client for an in-memory stub before importing the SUT.
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));
// Avoid pulling the real SMTP transport into the test process.
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => undefined) }));

import { createBookingOtp, verifyBookingOtp } from "@/lib/booking-otp";

const secret = process.env.SESSION_COOKIE_SECRET as string;
const hashOf = (code: string) =>
  crypto.createHmac("sha256", secret).update(code).digest("hex");

function makeAdmin(rows: unknown[]) {
  const calls = { updates: [] as unknown[], inserts: [] as unknown[] };
  const make = () => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    for (const m of ["select", "eq", "is", "ilike", "order", "limit"]) b[m] = self;
    b.update = (payload: unknown) => {
      calls.updates.push(payload);
      return b;
    };
    b.insert = (payload: unknown) => {
      calls.inserts.push(payload);
      return b;
    };
    (b as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: rows, error: null });
    return b;
  };
  return { client: { from: () => make() }, calls };
}

const future = () => new Date(Date.now() + 3_600_000).toISOString();
const past = () => new Date(Date.now() - 1_000).toISOString();

describe("verifyBookingOtp", () => {
  it("returns not_found when no active code exists", async () => {
    const { client } = makeAdmin([]);
    h.client = client;
    expect(await verifyBookingOtp("a@b.com", "123456")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("returns expired for a past expiry", async () => {
    const { client } = makeAdmin([
      { id: "o1", code_hash: hashOf("123456"), expires_at: past(), attempts: 0 },
    ]);
    h.client = client;
    expect(await verifyBookingOtp("a@b.com", "123456")).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("fails closed after max attempts", async () => {
    const { client } = makeAdmin([
      { id: "o1", code_hash: hashOf("123456"), expires_at: future(), attempts: 5 },
    ]);
    h.client = client;
    expect(await verifyBookingOtp("a@b.com", "123456")).toEqual({
      ok: false,
      reason: "max_attempts",
    });
  });

  it("returns mismatch and increments attempts on a wrong code", async () => {
    const { client, calls } = makeAdmin([
      { id: "o1", code_hash: hashOf("111111"), expires_at: future(), attempts: 1 },
    ]);
    h.client = client;
    const res = await verifyBookingOtp("a@b.com", "222222");
    expect(res).toEqual({ ok: false, reason: "mismatch" });
    expect(calls.updates).toEqual([{ attempts: 2 }]);
  });

  it("succeeds and consumes the code on a correct match", async () => {
    const { client, calls } = makeAdmin([
      { id: "o1", code_hash: hashOf("424242"), expires_at: future(), attempts: 0 },
    ]);
    h.client = client;
    const res = await verifyBookingOtp("a@b.com", "424242");
    expect(res).toEqual({ ok: true });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0]).toHaveProperty("consumed_at");
  });
});

describe("createBookingOtp", () => {
  it("invalidates prior codes, inserts a hashed 6-digit code, and returns the plaintext", async () => {
    const { client, calls } = makeAdmin([]);
    h.client = client;
    const code = await createBookingOtp("Foo@Bar.com");

    expect(code).toMatch(/^\d{6}$/);
    expect(calls.updates).toHaveLength(1); // invalidate sweep
    expect(calls.inserts).toHaveLength(1);

    const inserted = calls.inserts[0] as Record<string, unknown>;
    expect(inserted.email).toBe("foo@bar.com"); // lowercased
    expect(inserted.purpose).toBe("booking");
    expect(inserted.code_hash).toBe(hashOf(code)); // stored hashed, not plaintext
    expect(inserted.code_hash).not.toBe(code);
    expect(typeof inserted.expires_at).toBe("string");
  });
});
