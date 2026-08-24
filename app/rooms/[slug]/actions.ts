"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sign } from "@/lib/signed-cookie";
import { findAvailableRoom } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween, TAX_RATE, SERVICE_CHARGE_RATE } from "@/lib/pricing";
import { bookingFormSchema, type BookingIntent } from "@/lib/validation/rooms";
import {
  createBookingOtp,
  sendBookingOtpEmail,
  isBookingOtpRateLimited,
} from "@/lib/booking-otp";

const INTENT_COOKIE = "booking_intent";
const INTENT_TTL_SECONDS = 15 * 60; // 15 minutes — aligns with OTP expiry

export async function initiateBooking(formData: FormData) {
  const slug = (formData.get("slug") as string) || "";
  const back = slug ? `/rooms/${slug}` : "/rooms";

  const parsed = bookingFormSchema.safeParse({
    room_type_id: formData.get("room_type_id"),
    check_in: formData.get("check_in"),
    check_out: formData.get("check_out"),
    guests_count: formData.get("guests_count"),
    guest_name: formData.get("guest_name"),
    guest_email: formData.get("guest_email"),
    guest_phone: formData.get("guest_phone"),
    payment_method: formData.get("payment_method"),
    special_requests: formData.get("special_requests"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    redirect(`${back}?error=${encodeURIComponent(msg)}`);
  }
  const input = parsed.data;

  const supabase = await createServerClient();

  const { data: rt } = await supabase
    .from("room_types")
    .select("id, slug, base_price, max_guests, is_active")
    .eq("id", input.room_type_id)
    .single();
  if (!rt || !(rt as { is_active: boolean }).is_active) {
    redirect(`${back}?error=${encodeURIComponent("Room type not available")}`);
  }
  const roomType = rt as { id: string; slug: string; base_price: number; max_guests: number };

  if (input.guests_count > roomType.max_guests) {
    redirect(`${back}?error=${encodeURIComponent(`Max ${roomType.max_guests} guests for this room type`)}`);
  }

  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotelName = (settings as { hotel_name?: string } | null)?.hotel_name ?? "the hotel";
  // Room rate only — no tax or service charge (see lib/pricing constants).
  const taxRate = TAX_RATE;
  const serviceRate = SERVICE_CHARGE_RATE;

  const nights = nightsBetween(input.check_in, input.check_out);
  if (nights < 1) redirect(`${back}?error=${encodeURIComponent("Stay must be at least one night")}`);
  const totals = calculateBookingTotal({
    basePrice: Number(roomType.base_price),
    nights,
    taxRate,
    serviceRate,
  });

  const specialRequests = input.special_requests || undefined;

  const admin = createAdminClient();
  const roomId = await findAvailableRoom(admin, roomType.id, input.check_in, input.check_out);
  if (!roomId) {
    redirect(`${back}?error=${encodeURIComponent("No rooms available for those dates")}`);
  }

  const intent: BookingIntent = {
    check_in: input.check_in,
    check_out: input.check_out,
    guests_count: input.guests_count,
    guest_name: input.guest_name,
    guest_email: input.guest_email,
    guest_phone: input.guest_phone,
    payment_method: input.payment_method,
    rooms: [
      {
        room_id: roomId,
        room_type_id: roomType.id,
        guests_count: input.guests_count,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        service_amount: totals.serviceAmount,
        total_amount: totals.total,
      },
    ],
    special_requests: specialRequests,
    expires_at: Date.now() + INTENT_TTL_SECONDS * 1000,
  };

  const cookieStore = await cookies();
  cookieStore.set(INTENT_COOKIE, sign(intent), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INTENT_TTL_SECONDS,
  });

  // Throttle issuance so this endpoint can't be used to email-bomb an address
  // or burn the daily Gmail quota.
  if (await isBookingOtpRateLimited(input.guest_email)) {
    cookieStore.delete(INTENT_COOKIE);
    redirect(
      `${back}?error=${encodeURIComponent("Too many verification requests. Please wait a few minutes and try again.")}`,
    );
  }

  // Issue our own OTP (no Supabase Auth account is created). Send via Resend.
  const code = await createBookingOtp(input.guest_email);
  try {
    await sendBookingOtpEmail(input.guest_email, code, hotelName);
  } catch (err) {
    // Roll back the cookie so the verify page doesn't show a stale intent
    // for an OTP the guest never received.
    cookieStore.delete(INTENT_COOKIE);
    const msg = err instanceof Error ? err.message : "Email delivery failed";
    console.error("[initiateBooking] sendBookingOtpEmail failed:", msg);
    redirect(
      `${back}?error=${encodeURIComponent(`Couldn't send the verification email: ${msg}`)}`,
    );
  }

  const qs = new URLSearchParams({ email: input.guest_email });
  redirect(`/booking/verify?${qs.toString()}`);
}
