import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

// Node < 22 has no global WebSocket; supabase-js needs one at client init.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}

/**
 * Authenticated browser E2E — closes the "server actions behind auth" gap by
 * logging a real staff user in through the OTP UI and exercising the back
 * office. The OTP code is minted out-of-band via the admin API (the exact code
 * Supabase would email), so no SMTP/inbox is involved.
 *
 * GUARDED: skipped unless RUN_DB_TESTS=1 + local Supabase env are set.
 * Run against a LOCAL app + LOCAL Supabase only — it creates and deletes a user.
 */
const SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY;
const ENABLED = process.env.RUN_DB_TESTS === "1" && !!SUPABASE_URL && !!SERVICE_KEY;

test.describe("staff back office (authenticated)", () => {
  test.skip(
    !ENABLED,
    "Set RUN_DB_TESTS=1 + TEST_SUPABASE_URL/TEST_SUPABASE_SERVICE_KEY (local) to run",
  );

  const email = `e2e-recept-${Date.now()}@example.invalid`;
  let admin: SupabaseClient;
  let userId: string;

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: "E2E Receptionist" },
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = data.user.id;
    // handle_new_auth_user created a guest profile; promote to staff.
    await admin.from("profiles").update({ role: "receptionist", is_active: true }).eq("auth_user_id", userId);
  });

  test.afterAll(async () => {
    if (!userId) return;
    // The verifyOtp server action writes a `login` row to audit_logs — remove it.
    await admin.from("audit_logs").delete().eq("actor_email", email);
    // Delete the profile while the auth link still exists (FK is SET NULL).
    await admin.from("profiles").delete().eq("auth_user_id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  });

  test("logs in via OTP and reaches the bookings ops page", async ({ page }) => {
    const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const code = (link as { properties?: { email_otp?: string } })?.properties?.email_otp;
    expect(code, "email_otp from generateLink").toBeTruthy();

    // Drive the real verification form (skips the email-send step in /login).
    await page.goto(`/verify-otp?email=${encodeURIComponent(email)}`);
    await page.fill("#token", code as string);
    await page.getByRole("button", { name: /verify/i }).click();

    // Receptionist lands on /dashboard.
    await expect(page).toHaveURL(/\/dashboard/);

    // Server-rendered, auth-gated ops page loads (middleware let us through).
    await page.goto("/dashboard/bookings");
    await expect(page).toHaveURL(/\/dashboard\/bookings/);
    await expect(page.locator("body")).not.toContainText(/Staff only|Please sign in/i);
  });
});
