"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendTemplatedEmail } from "@/lib/email-from-template";
import { sign, verify } from "@/lib/signed-cookie";
import { setGuestSession } from "@/lib/guest-session";
import { isStillAvailable } from "@/lib/availability";
import { getSiteUrl } from "@/lib/site-url";
import { escapeLike } from "@/lib/sql-like";
import { bookingIntentSchema, type BookingIntent } from "@/lib/validation/rooms";
import type { TablesInsert, TablesUpdate } from "@/types/database";
import {
  createBookingOtp,
  sendBookingOtpEmail,
  verifyBookingOtp,
  isBookingOtpRateLimited,
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
  for (const room of intent.rooms) {
    const stillFree = await isStillAvailable(
      admin,
      room.room_id,
      intent.check_in,
      intent.check_out,
    );
    if (!stillFree) {
      cookieStore.delete(INTENT_COOKIE);
      redirect(
        `/rooms?error=${encodeURIComponent(
          intent.rooms.length > 1
            ? "One of your rooms was just taken. Please pick again."
            : "That room was just taken. Please pick again.",
        )}`,
      );
    }
  }

  // Find or create stub profile. Matches the walk-in flow: no auth_user_id.
  let guestId: string;
  const { data: existing } = await admin
    .from("profiles")
    .select("id, phone, full_name")
    .ilike("email", escapeLike(intent.guest_email))
    .maybeSingle();
  if (existing) {
    guestId = (existing as { id: string }).id;
    const ex = existing as { phone: string | null; full_name: string | null };
    const patch: TablesUpdate<"profiles"> = {};
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
  const created: Array<{
    id: string;
    booking_code: string;
    access_token: string;
    room: (typeof intent.rooms)[number];
    payload: TablesInsert<"bookings">;
  }> = [];

  for (const room of intent.rooms) {
    const insertPayload: TablesInsert<"bookings"> = {
      guest_id: guestId,
      guest_name: intent.guest_name,
      guest_email: intent.guest_email,
      guest_phone: intent.guest_phone,
      room_id: room.room_id,
      check_in: intent.check_in,
      check_out: intent.check_out,
      guests_count: room.guests_count,
      subtotal: room.subtotal,
      tax_amount: room.tax_amount,
      service_amount: room.service_amount,
      total_amount: room.total_amount,
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
      // A group booking is all-or-nothing: roll back rooms already inserted so
      // the guest isn't left holding half a reservation they never confirmed.
      for (const c of created) {
        await admin.from("bookings").delete().eq("id", c.id);
      }
      cookieStore.delete(INTENT_COOKIE);
      // 23P01 = the bookings_no_overlap exclusion constraint fired: another guest
      // won the race for this room in the moment between our availability recheck
      // and this insert. Show a friendly, actionable message rather than the raw
      // Postgres error (and never leak internal DB text to the guest).
      const friendly =
        bErr?.code === "23P01"
          ? intent.rooms.length > 1
            ? "One of your rooms was just taken. Please choose again."
            : "That room was just taken. Please choose your dates again."
          : "Sorry, we couldn't complete your booking. Please try again.";
      redirect(`/rooms?error=${encodeURIComponent(friendly)}`);
    }
    const b = booking as { id: string; booking_code: string; access_token: string };
    created.push({ ...b, room, payload: insertPayload });
  }

  cookieStore.delete(INTENT_COOKIE);

  // Stamp the device with a guest_session cookie so /my-bookings works on
  // this browser without login. 90-day TTL; user can clear via "Not you?".
  await setGuestSession(guestId, intent.guest_email);

  for (const c of created) {
    await writeAudit({
      action: "create",
      entityType: "bookings",
      entityId: c.id,
      newValues: { ...c.payload, status },
    });
  }

  // Confirmation emails — one per booking, each linking its own access_token
  // so the guest can return to view that booking without an account.
  const { data: rts } = await admin
    .from("room_types")
    .select("id, name")
    .in(
      "id",
      intent.rooms.map((r) => r.room_type_id),
    );
  const typeNames = new Map(
    ((rts as Array<{ id: string; name: string }> | null) ?? []).map((t) => [t.id, t.name]),
  );
  const { data: settings } = await admin
    .from("site_settings")
    .select("currency_symbol, google_place_uri")
    .single();
  const settingsX = (settings ?? {}) as {
    currency_symbol?: string;
    google_place_uri?: string | null;
  };
  for (const c of created) {
    const viewUrl = `${getSiteUrl()}/booking/${c.id}?t=${c.access_token}`;
    await sendTemplatedEmail("booking_confirmation", intent.guest_email, {
      guest_name: intent.guest_name,
      booking_code: c.booking_code,
      room_name: typeNames.get(c.room.room_type_id) ?? "",
      check_in: intent.check_in,
      check_out: intent.check_out,
      total_amount: c.room.total_amount.toLocaleString(),
      currency_symbol: settingsX.currency_symbol ?? "Rs.",
      view_url: viewUrl,
      google_review_url: settingsX.google_place_uri ?? "",
    });
  }

  // Single room lands on that booking's page; a group lands on the combined
  // list (the guest_session cookie set above makes it show all of them).
  if (created.length === 1) {
    redirect(`/booking/${created[0].id}?t=${created[0].access_token}`);
  }
  redirect(`/my-bookings?booked=${created.length}`);
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

  if (await isBookingOtpRateLimited(intent.guest_email)) {
    redirect(
      `/booking/verify?email=${encodeURIComponent(intent.guest_email)}&error=${encodeURIComponent("Too many code requests. Please wait a few minutes before trying again.")}`,
    );
  }

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
