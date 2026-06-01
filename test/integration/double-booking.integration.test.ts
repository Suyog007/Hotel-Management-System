import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database";

/**
 * Integration test for the booking overlap exclusion constraint (migration
 * 0005). It exercises real Postgres behaviour that unit tests cannot mock.
 *
 * GUARDED: skipped unless you opt in against a LOCAL / throwaway Supabase:
 *   RUN_DB_TESTS=1 \
 *   TEST_SUPABASE_URL=http://127.0.0.1:54321 \
 *   TEST_SUPABASE_SERVICE_KEY=<local service_role key> \
 *   npx vitest run test/integration
 *
 * NEVER point these at your production project — it inserts (and cleans up)
 * booking rows. Requires migrations 0001-0011 applied and the 0006 sample rooms.
 */
const url = process.env.TEST_SUPABASE_URL;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY;
const ENABLED = process.env.RUN_DB_TESTS === "1" && !!url && !!serviceKey;

describe.runIf(ENABLED)("DB: bookings overlap exclusion constraint (0005)", () => {
  // Created lazily in beforeAll — the describe body runs during collection even
  // when skipped, so we must not touch createClient with empty env here.
  let admin: SupabaseClient<Database>;
  const created: string[] = [];
  let roomId: string;

  const booking = (checkIn: string, checkOut: string): TablesInsert<"bookings"> => ({
    guest_name: "Integration Test",
    guest_email: "integration@example.invalid",
    guest_phone: "+9779800000000",
    room_id: roomId,
    check_in: checkIn,
    check_out: checkOut,
    guests_count: 1,
    subtotal: 100,
    total_amount: 100,
    status: "confirmed",
    payment_method: "pay_at_hotel",
    verification_method: "staff_call",
  });

  beforeAll(async () => {
    admin = createClient<Database>(url as string, serviceKey as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin
      .from("rooms")
      .select("id")
      .limit(1)
      .single();
    if (error || !data) throw new Error("No rooms found — apply 0006 sample rooms");
    roomId = data.id;
  });

  afterAll(async () => {
    if (created.length) await admin.from("bookings").delete().in("id", created);
  });

  it("accepts the first booking and rejects an overlapping one on the same room", async () => {
    const first = await admin
      .from("bookings")
      .insert(booking("2999-01-10", "2999-01-12"))
      .select("id")
      .single();
    expect(first.error).toBeNull();
    if (first.data) created.push(first.data.id);

    const overlap = await admin
      .from("bookings")
      .insert(booking("2999-01-11", "2999-01-13"))
      .select("id")
      .single();
    // exclusion_violation (SQLSTATE 23P01)
    expect(overlap.error).not.toBeNull();
    if (overlap.data) created.push(overlap.data.id);
  });

  it("allows an adjacent (non-overlapping) booking on the same room", async () => {
    const adjacent = await admin
      .from("bookings")
      .insert(booking("2999-01-12", "2999-01-14"))
      .select("id")
      .single();
    expect(adjacent.error).toBeNull();
    if (adjacent.data) created.push(adjacent.data.id);
  });
});
