import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  DB_TESTS_ENABLED,
  anonClient,
  serviceClient,
  authedClientFor,
  minimalBooking,
  deleteUsers,
} from "./_helpers";

/**
 * RLS enforcement (migration 0002) — the security boundary the whole app leans
 * on. Verifies the anon surface, service-role bypass, and the role-based
 * authorization that staff server actions (check-in/out, etc.) rely on.
 *
 * GUARDED: skipped unless RUN_DB_TESTS=1 + local Supabase env are set. See
 * TESTING.md. NEVER run against production.
 */
describe.runIf(DB_TESTS_ENABLED)("RLS: anon surface", () => {
  it("anon CAN read the public catalog (room_types)", async () => {
    const { data, error } = await anonClient().from("room_types").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("anon CAN read public CMS (site_settings)", async () => {
    const { data, error } = await anonClient().from("site_settings").select("hotel_name").limit(1);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(0);
  });

  it("anon CANNOT see otp_verifications rows (even when they exist)", async () => {
    const svc = serviceClient();
    await svc.from("otp_verifications").insert({
      email: "rls-otp@example.invalid",
      code_hash: "deadbeef",
      purpose: "booking",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const { data } = await anonClient().from("otp_verifications").select("id");
    expect(data ?? []).toHaveLength(0); // RLS hides every row
    await svc.from("otp_verifications").delete().eq("email", "rls-otp@example.invalid");
  });

  it("anon CANNOT see audit_logs", async () => {
    const { data } = await anonClient().from("audit_logs").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("anon CANNOT see email_templates (super-admin only)", async () => {
    const { data } = await anonClient().from("email_templates").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("anon CANNOT insert into a manager-write table (room_types)", async () => {
    const { error } = await anonClient().from("room_types").insert({
      name: "Hacker Suite",
      slug: `hacker-${Date.now()}`,
      base_price: 1,
      max_guests: 1,
    });
    expect(error).not.toBeNull(); // RLS rejects the write
  });

  it("anon CANNOT insert a booking directly (no anon-insert policy)", async () => {
    const { data: room } = await serviceClient().from("rooms").select("id").limit(1).single();
    const { error } = await anonClient()
      .from("bookings")
      .insert(minimalBooking(room!.id, null));
    expect(error).not.toBeNull();
  });
});

describe.runIf(DB_TESTS_ENABLED)("RLS: role-based authorization", () => {
  const userIds: string[] = [];
  const bookingIds: string[] = [];
  let staff: Awaited<ReturnType<typeof authedClientFor>>;
  let guestA: Awaited<ReturnType<typeof authedClientFor>>;
  let guestB: Awaited<ReturnType<typeof authedClientFor>>;
  let ownedBookingId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    staff = await authedClientFor(`rls-staff-${stamp}@example.invalid`, "receptionist");
    guestA = await authedClientFor(`rls-guesta-${stamp}@example.invalid`, "guest");
    guestB = await authedClientFor(`rls-guestb-${stamp}@example.invalid`, "guest");
    userIds.push(staff.userId, guestA.userId, guestB.userId);

    const svc = serviceClient();
    const { data: room } = await svc.from("rooms").select("id").limit(1).single();
    const { data: booking } = await svc
      .from("bookings")
      .insert(minimalBooking(room!.id, guestA.profileId))
      .select("id")
      .single();
    ownedBookingId = booking!.id;
    bookingIds.push(ownedBookingId);
  });

  afterAll(async () => {
    const svc = serviceClient();
    if (bookingIds.length) await svc.from("bookings").delete().in("id", bookingIds);
    await deleteUsers(userIds);
  });

  it("guest CAN read their own booking", async () => {
    const { data } = await guestA.client.from("bookings").select("id").eq("id", ownedBookingId);
    expect((data ?? []).map((b) => b.id)).toContain(ownedBookingId);
  });

  it("a different guest CANNOT read someone else's booking", async () => {
    const { data } = await guestB.client.from("bookings").select("id").eq("id", ownedBookingId);
    expect(data ?? []).toHaveLength(0);
  });

  it("staff CAN read any booking", async () => {
    const { data } = await staff.client.from("bookings").select("id").eq("id", ownedBookingId);
    expect((data ?? []).map((b) => b.id)).toContain(ownedBookingId);
  });

  it("staff CAN update booking status (the check-in/out write path)", async () => {
    const { error } = await staff.client
      .from("bookings")
      .update({ status: "checked_in" })
      .eq("id", ownedBookingId);
    expect(error).toBeNull();
    const { data } = await serviceClient()
      .from("bookings")
      .select("status")
      .eq("id", ownedBookingId)
      .single();
    expect(data!.status).toBe("checked_in");
  });

  it("guest CANNOT update a booking (no guest-write policy)", async () => {
    await guestA.client
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", ownedBookingId);
    // RLS yields zero affected rows rather than mutating; status stays as staff left it.
    const { data } = await serviceClient()
      .from("bookings")
      .select("status")
      .eq("id", ownedBookingId)
      .single();
    expect(data!.status).toBe("checked_in");
  });

  it("guest CANNOT read otp_verifications or audit_logs", async () => {
    const otp = await guestA.client.from("otp_verifications").select("id");
    const audit = await guestA.client.from("audit_logs").select("id");
    expect(otp.data ?? []).toHaveLength(0);
    expect(audit.data ?? []).toHaveLength(0);
  });
});
