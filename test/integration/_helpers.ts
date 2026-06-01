/**
 * Shared helpers for DB integration tests. Everything here targets a LOCAL /
 * throwaway Supabase — never production. Suites that import these gate on
 * `DB_TESTS_ENABLED` so they're skipped unless you opt in:
 *
 *   RUN_DB_TESTS=1
 *   TEST_SUPABASE_URL=http://127.0.0.1:54321
 *   TEST_SUPABASE_ANON_KEY=<local anon key>
 *   TEST_SUPABASE_SERVICE_KEY=<local service_role key>
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database";

export const url = process.env.TEST_SUPABASE_URL;
export const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
export const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY;

export const DB_TESTS_ENABLED =
  process.env.RUN_DB_TESTS === "1" && !!url && !!anonKey && !!serviceKey;

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url as string, anonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(url as string, serviceKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Role = "guest" | "receptionist" | "manager" | "super_admin";

/**
 * Ensure an auth user exists with `role`, then return a client authenticated AS
 * that user (session established via the email-OTP path, exactly like the app).
 * The `handle_new_auth_user` trigger creates the profile on insert; we then set
 * the role with the service client.
 */
export async function authedClientFor(
  email: string,
  role: Role,
): Promise<{ client: SupabaseClient<Database>; profileId: string; userId: string }> {
  const admin = serviceClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });

  let userId = created?.user?.id;
  if (!userId) {
    // Already registered from a prior run — look it up.
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )?.id;
  }
  if (!userId) throw new Error(`could not create/find user ${email}: ${error?.message}`);

  await admin.from("profiles").update({ role, is_active: true }).eq("auth_user_id", userId);
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .single();
  if (!prof) throw new Error(`no profile linked for ${email}`);

  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const token = link?.properties?.email_otp;
  if (!token) throw new Error("generateLink returned no email_otp");

  const client = anonClient();
  const { error: verr } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (verr) throw new Error(`verifyOtp failed for ${email}: ${verr.message}`);

  return { client, profileId: prof.id, userId };
}

/** A minimal valid booking row for a given room + guest, owned by `guestId`. */
export function minimalBooking(
  roomId: string,
  guestId: string | null,
  checkIn = "2999-02-01",
  checkOut = "2999-02-03",
): TablesInsert<"bookings"> {
  return {
    guest_id: guestId,
    guest_name: "RLS Test Guest",
    guest_email: "rls-guest@example.invalid",
    guest_phone: "+9779800000001",
    room_id: roomId,
    check_in: checkIn,
    check_out: checkOut,
    guests_count: 1,
    subtotal: 100,
    total_amount: 100,
    status: "confirmed",
    payment_method: "pay_at_hotel",
    verification_method: "staff_call",
  };
}

/**
 * Remove test users and their profiles. Order matters: profiles.auth_user_id is
 * ON DELETE SET NULL, so deleting the auth user first would orphan the profile
 * row. Delete profiles by the live link first, then the auth users.
 */
export async function deleteUsers(userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const admin = serviceClient();
  await admin.from("profiles").delete().in("auth_user_id", userIds);
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}
