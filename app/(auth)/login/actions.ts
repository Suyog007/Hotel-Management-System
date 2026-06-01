"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSchema } from "@/lib/validation/auth";
import { sendStaffOtpEmail } from "@/lib/booking-otp";

export async function requestOtp(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  const next = (formData.get("next") as string | null) || undefined;
  const from = (formData.get("from") as string | null) || undefined;

  if (!parsed.success) {
    const qs = new URLSearchParams({ error: "Please enter a valid email." });
    if (next) qs.set("next", next);
    redirect(`/login?${qs.toString()}`);
  }

  const email = parsed.data.email.toLowerCase();

  // Gate: only active staff (receptionist / manager / super_admin) can request
  // an OTP. Reject everyone else up front so the verify-otp page isn't a dead
  // end for guests and typos. Trade-off vs. email enumeration is acceptable
  // for a single-property hotel with a tiny staff list.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .ilike("email", email)
    .maybeSingle();
  const p = profile as { role?: string; is_active?: boolean } | null;
  const staffRoles = ["receptionist", "manager", "super_admin"];
  const isStaff = p && p.role && staffRoles.includes(p.role) && p.is_active !== false;
  if (!isStaff) {
    const qs = new URLSearchParams({
      error: "This email isn't registered as staff. Ask the manager to invite you.",
    });
    if (next) qs.set("next", next);
    redirect(`/login?${qs.toString()}`);
  }

  // Mint an OTP via Supabase Auth's admin API (so /verify-otp can validate
  // it the standard way), then deliver via our own Gmail SMTP. Supabase's
  // default SMTP is unreliable; the booking flow already uses Gmail.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const code = link?.properties?.email_otp;
  if (linkErr || !code) {
    const qs = new URLSearchParams({
      error: linkErr?.message ?? "Could not generate sign-in code. Try again.",
    });
    if (next) qs.set("next", next);
    redirect(`/login?${qs.toString()}`);
  }

  const { data: settingsRow } = await admin
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotelName =
    (settingsRow as { hotel_name?: string } | null)?.hotel_name ?? "the hotel";

  try {
    await sendStaffOtpEmail(email, code, hotelName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email delivery failed.";
    const qs = new URLSearchParams({ error: msg });
    if (next) qs.set("next", next);
    redirect(`/login?${qs.toString()}`);
  }

  const qs = new URLSearchParams({ email });
  if (next) qs.set("next", next);
  if (from === "resend") qs.set("resent", "1");
  redirect(`/verify-otp?${qs.toString()}`);
}
