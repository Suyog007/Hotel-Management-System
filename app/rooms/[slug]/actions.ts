"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sign } from "@/lib/signed-cookie";
import { findAvailableRoom } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween, AC_ADDON_PRICE, isAcAddonEligible } from "@/lib/pricing";
import { bookingFormSchema, type BookingIntent } from "@/lib/validation/rooms";
import { createBookingOtp, sendBookingOtpEmail } from "@/lib/booking-otp";

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
    ac_addon: formData.get("ac_addon") === "on",
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

  // AC is a paid upgrade on Standard rooms only — re-validate server-side so a
  // tampered form can't add it (or its 500 charge) to other room types.
  const acSelected = input.ac_addon === true && isAcAddonEligible(roomType.slug);
  const addonAmount = acSelected ? AC_ADDON_PRICE : 0;
  if (input.guests_count > roomType.max_guests) {
    redirect(`${back}?error=${encodeURIComponent(`Max ${roomType.max_guests} guests for this room type`)}`);
  }

  const { data: settings } = await supabase
    .from("site_settings")
    .select("tax_rate, service_charge_rate, hotel_name")
    .single();
  const taxRate = Number((settings as { tax_rate?: number } | null)?.tax_rate ?? 0);
  const serviceRate = Number((settings as { service_charge_rate?: number } | null)?.service_charge_rate ?? 0);
  const hotelName = (settings as { hotel_name?: string } | null)?.hotel_name ?? "the hotel";

  const nights = nightsBetween(input.check_in, input.check_out);
  if (nights < 1) redirect(`${back}?error=${encodeURIComponent("Stay must be at least one night")}`);
  const totals = calculateBookingTotal({
    basePrice: Number(roomType.base_price),
    nights,
    taxRate,
    serviceRate,
    addonAmount,
  });

  // Record the AC choice on the booking (no dedicated column needed pre-launch).
  const acNote = acSelected ? `Air conditioning add-on (+${AC_ADDON_PRICE})` : null;
  const specialRequests =
    [acNote, input.special_requests].filter(Boolean).join(" — ") || undefined;

  const admin = createAdminClient();
  const roomId = await findAvailableRoom(admin, roomType.id, input.check_in, input.check_out);
  if (!roomId) {
    redirect(`${back}?error=${encodeURIComponent("No rooms available for those dates")}`);
  }

  const intent: BookingIntent = {
    room_id: roomId,
    room_type_id: roomType.id,
    check_in: input.check_in,
    check_out: input.check_out,
    guests_count: input.guests_count,
    guest_name: input.guest_name,
    guest_email: input.guest_email,
    guest_phone: input.guest_phone,
    payment_method: input.payment_method,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    service_amount: totals.serviceAmount,
    total_amount: totals.total,
    special_requests: specialRequests,
    ac_addon: acSelected,
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
