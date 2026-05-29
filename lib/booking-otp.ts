import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const TTL_SECONDS = 15 * 60; // matches the booking_intent cookie TTL
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  const secret = process.env.SESSION_COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_COOKIE_SECRET must be set (>=16 chars) to hash OTP codes");
  }
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

function randomCode(): string {
  // 6-digit zero-padded, generated from crypto-secure bytes (not Math.random).
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/**
 * Issue a new booking OTP for `email`. Invalidates any prior un-consumed
 * booking-purpose OTPs for that email so resend works without leaving stale
 * rows. Returns the plaintext code so the caller can email it.
 */
export async function createBookingOtp(email: string): Promise<string> {
  const admin = createAdminClient();
  const lowered = email.trim().toLowerCase();
  const code = randomCode();
  const code_hash = hashCode(code);
  const expires_at = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  // Invalidate any in-flight code for this email + purpose.
  await admin
    .from("otp_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("purpose", "booking")
    .is("consumed_at", null)
    .ilike("email", lowered);

  const { error } = await admin.from("otp_verifications").insert({
    email: lowered,
    code_hash,
    purpose: "booking",
    expires_at,
  });
  if (error) throw new Error(`otp insert failed: ${error.message}`);
  return code;
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "max_attempts" | "mismatch" };

/**
 * Validate `code` against the most recent un-consumed booking OTP for `email`.
 * Marks the row consumed on success. Increments attempts on mismatch and
 * fails closed after MAX_ATTEMPTS.
 */
export async function verifyBookingOtp(
  email: string,
  code: string,
): Promise<OtpVerifyResult> {
  const admin = createAdminClient();
  const lowered = email.trim().toLowerCase();

  const { data: rows } = await admin
    .from("otp_verifications")
    .select("id, code_hash, expires_at, attempts")
    .eq("purpose", "booking")
    .is("consumed_at", null)
    .ilike("email", lowered)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = (rows as Array<{
    id: string;
    code_hash: string;
    expires_at: string;
    attempts: number;
  }> | null)?.[0];
  if (!row) return { ok: false, reason: "not_found" };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "max_attempts" };
  }

  const expected = hashCode(code);
  // timing-safe compare
  const a = Buffer.from(row.code_hash);
  const b = Buffer.from(expected);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    await admin
      .from("otp_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "mismatch" };
  }

  await admin
    .from("otp_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ok: true };
}

/**
 * Send the booking-confirmation OTP via Gmail SMTP. No-ops with a warning if
 * GMAIL_APP_PASSWORD is unset (dev convenience — same pattern as lib/email.ts).
 */
export async function sendBookingOtpEmail(
  email: string,
  code: string,
  hotelName: string,
): Promise<void> {
  const subject = `Your booking code for ${hotelName}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 8px; font-size: 18px;">Confirm your booking</h2>
      <p style="margin: 0 0 16px; color: #555;">
        Enter this 6-digit code on the verification page to confirm your reservation at <strong>${hotelName}</strong>.
      </p>
      <p style="margin: 24px 0; font-size: 28px; font-weight: 600; letter-spacing: 6px; text-align: center; font-family: ui-monospace, monospace;">
        ${code}
      </p>
      <p style="margin: 0; font-size: 13px; color: #888;">
        This code expires in 15 minutes. If you didn't request a booking, you can ignore this email.
      </p>
    </div>
  `;
  const text = `Your ${hotelName} booking code: ${code}\n\nThis code expires in 15 minutes.\nIf you didn't request a booking, ignore this email.`;
  await sendEmail({ to: email, subject, html, text });
}
