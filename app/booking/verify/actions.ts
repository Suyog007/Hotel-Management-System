"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendTemplatedEmail } from "@/lib/email-from-template";
import { sign, verify } from "@/lib/signed-cookie";
import { isStillAvailable } from "@/lib/availability";
import { bookingIntentSchema, type BookingIntent } from "@/lib/validation/rooms";
import {
  createBookingOtp,
  sendBookingOtpEmail,
  verifyBookingOtp,
} from "@/lib/booking-otp";

const INTENT_COOKIE = "booking_intent";

function readIntent(raw: string | undefined): BookingIntent | null {
  const candidate = verify<BookingIntent>(raw);
  if (!candidate) return null;
  const parsed = bookingIntentSchema.safeParse(candidate);
  if (!parsed.success) return null;
  if (parsed.data.expires_at < Date.now()) return null;
  return parsed.data;
}

export async function verifyAndCreateBooking(formData: FormData) {
  const code = ((formData.get("token") as string) || "").trim();
  const cookieStore = await cookies();
  const intent = readIntent(cookieStore.get(INTENT_COOKIE)?.value);
  if (!intent) {
    redirect(`/rooms?error=${encodeURIComponent("Booking session expired — please try again.")}`);
  }

  if (!/^\d{6}$/.test(code)) {
    redirect(
      `/booking/verify?email=${encodeURIComponent(intent.guest_email)}&error=${encodeURIComponent("Enter the 6-digit code.")}`,
    );
  }

  const result = await verifyBookingOtp(intent.guest_email, code);
  if (!result.ok) {
    const msg =
      result.reason === "expired"
        ? "That code expired — request a new one."
        : result.reason === "max_attempts"
          ? "Too many tries — request a new code."
          : result.reason === "not_found"
            ? "No active code — request a new one."
            : "Invalid code. Try again.";
    redirect(
      `/booking/verify?email=${encodeURIComponent(intent.guest_email)}&error=${encodeURIComponent(msg)}`,
    );
  }

  // Re-check availability — guard against concurrent bookings during the OTP window.
  const admin = createAdminClient();
  const stillFree = await isStillAvailable(
    admin,
    intent.room_id,
    intent.check_in,
    intent.check_out,
  );
  if (!stillFree) {
    cookieStore.delete(INTENT_COOKIE);
    redirect(`/rooms?error=${encodeURIComponent("That room was just taken. Please pick again.")}`);
  }

  // Find or create stub profile. Matches the walk-in flow: no auth_user_id.
  let guestId: string;
  const { data: existing } = await admin
    .from("profiles")
    .select("id, phone, full_name")
    .ilike("email", intent.guest_email)
    .maybeSingle();
  if (existing) {
    guestId = (existing as { id: string }).id;
    const ex = existing as { phone: string | null; full_name: string | null };
    const patch: Record<string, string> = {};
    if (!ex.phone && intent.guest_phone) patch.phone = intent.guest_phone;
    if (!ex.full_name && intent.guest_name) patch.full_name = intent.guest_name;
    if (Object.keys(patch).length) {
      await admin.from("profiles").update(patch).eq("id", guestId);
    }
  } else {
    const { data: created, error: pErr } = await admin
      .from("profiles")
      .insert({
        email: intent.guest_email,
        full_name: intent.guest_name,
        phone: intent.guest_phone,
        role: "guest",
        is_stub: true,
        is_active: true,
      })
      .select("id")
      .single();
    if (pErr || !created) {
      redirect(`/rooms?error=${encodeURIComponent(`Profile create failed: ${pErr?.message ?? "unknown"}`)}`);
    }
    guestId = (created as { id: string }).id;
  }

  const status = intent.payment_method === "pay_at_hotel" ? "confirmed" : "pending";
  const insertPayload = {
    guest_id: guestId,
    guest_name: intent.guest_name,
    guest_email: intent.guest_email,
    guest_phone: intent.guest_phone,
    room_id: intent.room_id,
    check_in: intent.check_in,
    check_out: intent.check_out,
    guests_count: intent.guests_count,
    subtotal: intent.subtotal,
    tax_amount: intent.tax_amount,
    service_amount: intent.service_amount,
    total_amount: intent.total_amount,
    status,
    payment_status: "unpaid",
    payment_method: intent.payment_method,
    verification_method: "otp",
    special_requests: intent.special_requests ?? null,
  };

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .insert(insertPayload)
    .select("id, booking_code, access_token")
    .single();
  if (bErr || !booking) {
    cookieStore.delete(INTENT_COOKIE);
    redirect(`/rooms?error=${encodeURIComponent(bErr?.message ?? "Booking create failed")}`);
  }
  const b = booking as { id: string; booking_code: string; access_token: string };

  cookieStore.delete(INTENT_COOKIE);

  await writeAudit({
    action: "create",
    entityType: "bookings",
    entityId: b.id,
    newValues: { ...insertPayload, status },
  });

  // Confirmation email — link includes the access_token so the guest can return
  // to view their booking without an account.
  const { data: rt } = await admin
    .from("room_types")
    .select("name")
    .eq("id", intent.room_type_id)
    .single();
  const { data: settings } = await admin
    .from("site_settings")
    .select("currency_symbol, google_place_uri")
    .single();
  const settingsX = (settings ?? {}) as {
    currency_symbol?: string;
    google_place_uri?: string | null;
  };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const viewUrl = `${siteUrl}/booking/${b.id}?t=${b.access_token}`;
  await sendTemplatedEmail("booking_confirmation", intent.guest_email, {
    guest_name: intent.guest_name,
    booking_code: b.booking_code,
    room_name: (rt as { name?: string } | null)?.name ?? "",
    check_in: intent.check_in,
    check_out: intent.check_out,
    total_amount: intent.total_amount.toLocaleString(),
    currency_symbol: settingsX.currency_symbol ?? "Rs.",
    view_url: viewUrl,
    google_review_url: settingsX.google_place_uri ?? "",
  });

  const tail = intent.payment_method === "online" ? "&pay=pending" : "";
  redirect(`/booking/${b.id}?t=${b.access_token}${tail}`);
}

export async function resendBookingOtp() {
  const cookieStore = await cookies();
  const intent = readIntent(cookieStore.get(INTENT_COOKIE)?.value);
  if (!intent) {
    redirect(`/rooms?error=${encodeURIComponent("Booking session expired — please try again.")}`);
  }

  // Refresh the intent's TTL clock so resend doesn't shorten the window.
  const refreshed: BookingIntent = {
    ...intent,
    expires_at: Date.now() + 15 * 60 * 1000,
  };
  cookieStore.set(INTENT_COOKIE, sign(refreshed), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotelName = (settings?.hotel_name as string) ?? "the hotel";

  const code = await createBookingOtp(intent.guest_email);
  try {
    await sendBookingOtpEmail(intent.guest_email, code, hotelName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email delivery failed";
    console.error("[resendBookingOtp] sendBookingOtpEmail failed:", msg);
    redirect(
      `/booking/verify?email=${encodeURIComponent(intent.guest_email)}&error=${encodeURIComponent(`Couldn't send a fresh code: ${msg}`)}`,
    );
  }
  redirect(
    `/booking/verify?email=${encodeURIComponent(intent.guest_email)}&resent=1`,
  );
}
