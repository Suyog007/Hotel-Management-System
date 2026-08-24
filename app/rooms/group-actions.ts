"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sign } from "@/lib/signed-cookie";
import { findAvailableRooms } from "@/lib/availability";
import {
  calculateBookingTotal,
  nightsBetween,
  TAX_RATE,
  SERVICE_CHARGE_RATE,
} from "@/lib/pricing";
import {
  groupBookingFormSchema,
  type BookingIntent,
  type BookingIntentRoom,
} from "@/lib/validation/rooms";
import {
  createBookingOtp,
  sendBookingOtpEmail,
  isBookingOtpRateLimited,
} from "@/lib/booking-otp";

const INTENT_COOKIE = "booking_intent";
const INTENT_TTL_SECONDS = 15 * 60; // 15 minutes — aligns with OTP expiry

/**
 * Group-cart variant of `initiateBooking` (app/rooms/[slug]/actions.ts): the
 * guest picked several rooms on /rooms, one form covers them all, one OTP
 * verifies the email, and finalize inserts one bookings row per room.
 */
export async function initiateGroupBooking(formData: FormData) {
  const parsed = groupBookingFormSchema.safeParse({
    check_in: formData.get("check_in"),
    check_out: formData.get("check_out"),
    guests_count: formData.get("guests_count"),
    guest_name: formData.get("guest_name"),
    guest_email: formData.get("guest_email"),
    guest_phone: formData.get("guest_phone"),
    payment_method: formData.get("payment_method"),
    special_requests: formData.get("special_requests"),
    selection: formData.get("selection"),
  });
  // Errors bounce back to /rooms; keep the stay params so the guest lands on
  // their search (and the group cart) instead of the blank listing.
  const back = parsed.success
    ? `/rooms?check_in=${parsed.data.check_in}&check_out=${parsed.data.check_out}&guests=${parsed.data.guests_count}`
    : "/rooms";
  // Explicit annotation so TS applies never-returning control-flow analysis
  // at call sites (a bare arrow's inferred `never` isn't enough).
  const bail: (msg: string) => never = (msg) => {
    const sep = back.includes("?") ? "&" : "?";
    redirect(`${back}${sep}error=${encodeURIComponent(msg)}`);
  };

  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    bail(msg);
  }
  const input = parsed.data;

  const nights = nightsBetween(input.check_in, input.check_out);
  if (nights < 1) bail("Stay must be at least one night");

  const roomCount = input.selection.reduce((n, s) => n + s.quantity, 0);
  if (input.guests_count < roomCount) {
    bail("You have more rooms than guests — remove a room.");
  }

  const supabase = await createServerClient();
  const { data: types } = await supabase
    .from("room_types")
    .select("id, name, base_price, max_guests, is_active")
    .in(
      "id",
      input.selection.map((s) => s.room_type_id),
    );
  const typeById = new Map(
    (
      (types as Array<{
        id: string;
        name: string;
        base_price: number;
        max_guests: number;
        is_active: boolean;
      }> | null) ?? []
    ).map((t) => [t.id, t]),
  );

  // Expand the selection into concrete rooms, checking each type as we go.
  const admin = createAdminClient();
  const picked: Array<{ roomId: string; typeId: string; basePrice: number; maxGuests: number }> =
    [];
  let totalCapacity = 0;
  for (const sel of input.selection) {
    const rt = typeById.get(sel.room_type_id);
    if (!rt || !rt.is_active) bail("A selected room type is no longer available.");
    const roomIds = await findAvailableRooms(
      admin,
      rt.id,
      input.check_in,
      input.check_out,
      sel.quantity,
    );
    if (roomIds.length < sel.quantity) {
      bail(
        `Only ${roomIds.length} ${rt.name} room${roomIds.length === 1 ? "" : "s"} left for those dates — adjust your selection.`,
      );
    }
    for (const roomId of roomIds) {
      picked.push({
        roomId,
        typeId: rt.id,
        basePrice: Number(rt.base_price),
        maxGuests: rt.max_guests,
      });
      totalCapacity += rt.max_guests;
    }
  }
  if (totalCapacity < input.guests_count) {
    bail(
      `The selected rooms sleep ${totalCapacity} — add another room for ${input.guests_count} guests.`,
    );
  }

  // Split the party across the rooms: everyone gets a bed — each room takes
  // at least one guest, then fills to capacity in selection order.
  let unassigned = input.guests_count - picked.length;
  const rooms: BookingIntentRoom[] = picked.map((p) => {
    const extra = Math.min(unassigned, p.maxGuests - 1);
    unassigned -= extra;
    const totals = calculateBookingTotal({
      basePrice: p.basePrice,
      nights,
      taxRate: TAX_RATE,
      serviceRate: SERVICE_CHARGE_RATE,
    });
    return {
      room_id: p.roomId,
      room_type_id: p.typeId,
      guests_count: 1 + extra,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      service_amount: totals.serviceAmount,
      total_amount: totals.total,
    };
  });

  const intent: BookingIntent = {
    check_in: input.check_in,
    check_out: input.check_out,
    guests_count: input.guests_count,
    guest_name: input.guest_name,
    guest_email: input.guest_email,
    guest_phone: input.guest_phone,
    payment_method: input.payment_method,
    rooms,
    special_requests: input.special_requests || undefined,
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

  // Same throttle as the single-room flow — see initiateBooking.
  if (await isBookingOtpRateLimited(input.guest_email)) {
    cookieStore.delete(INTENT_COOKIE);
    bail("Too many verification requests. Please wait a few minutes and try again.");
  }

  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotelName = (settings as { hotel_name?: string } | null)?.hotel_name ?? "the hotel";

  const code = await createBookingOtp(input.guest_email);
  try {
    await sendBookingOtpEmail(input.guest_email, code, hotelName);
  } catch (err) {
    cookieStore.delete(INTENT_COOKIE);
    const msg = err instanceof Error ? err.message : "Email delivery failed";
    console.error("[initiateGroupBooking] sendBookingOtpEmail failed:", msg);
    bail(`Couldn't send the verification email: ${msg}`);
  }

  redirect(`/booking/verify?email=${encodeURIComponent(input.guest_email)}`);
}
