"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { notifyStaff } from "@/lib/notify-staff";
import { friendlyDbError } from "@/lib/friendly-error";
import { findAvailableRoom, isStillAvailable } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween, TAX_RATE, SERVICE_CHARGE_RATE } from "@/lib/pricing";
import { walkInBookingSchema } from "@/lib/validation/staff";
import type { TablesInsert } from "@/types/database";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);

function bail(msg: string): never {
  redirect(`/dashboard/walk-in?error=${encodeURIComponent(msg)}`);
}

export async function createWalkInBooking(formData: FormData) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/walk-in");
  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const a = actor as { id: string; role: string } | null;
  if (!a || !STAFF_ROLES.has(a.role)) bail("Staff access required");

  const parsed = walkInBookingSchema.safeParse({
    room_type_id: formData.get("room_type_id"),
    room_id: formData.get("room_id") || undefined,
    check_in: formData.get("check_in"),
    check_out: formData.get("check_out"),
    guests_count: formData.get("guests_count"),
    guest_name: formData.get("guest_name"),
    guest_email: formData.get("guest_email"),
    guest_phone: formData.get("guest_phone"),
    payment_method: formData.get("payment_method"),
    payment_status: formData.get("payment_status") || "unpaid",
    payment_provider: formData.get("payment_provider") || undefined,
    payment_reference: formData.get("payment_reference"),
    initial_status: formData.get("initial_status") || "confirmed",
    special_requests: formData.get("special_requests"),
  });
  if (!parsed.success) {
    bail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const input = parsed.data;

  const admin = createAdminClient();

  // Room type lookup
  const { data: rt } = await admin
    .from("room_types")
    .select("id, name, base_price, max_guests, is_active")
    .eq("id", input.room_type_id)
    .single();
  const roomType = rt as { id: string; name: string; base_price: number; max_guests: number; is_active: boolean } | null;
  if (!roomType || !roomType.is_active) bail("Room type not available");
  if (input.guests_count > roomType.max_guests) {
    bail(`Max ${roomType.max_guests} guests for this room type`);
  }

  // Compute totals — room rate only, no tax/service (see lib/pricing constants).
  const taxRate = TAX_RATE;
  const serviceRate = SERVICE_CHARGE_RATE;
  const nights = nightsBetween(input.check_in, input.check_out);
  if (nights < 1) bail("Stay must be at least one night");
  const totals = calculateBookingTotal({
    basePrice: Number(roomType.base_price),
    nights,
    taxRate,
    serviceRate,
  });

  // Room assignment. If staff picked a specific room, honour it only when it
  // belongs to this type, isn't under maintenance, and is still free for the
  // range — otherwise (e.g. taken between the form load and submit) fall back
  // to auto-assigning the first free room of the type rather than hard-failing.
  let roomId: string | null = null;
  if (input.room_id) {
    const { data: chosen } = await admin
      .from("rooms")
      .select("id, type_id, status")
      .eq("id", input.room_id)
      .maybeSingle();
    const c = chosen as { id: string; type_id: string; status: string } | null;
    if (
      c &&
      c.type_id === roomType.id &&
      c.status !== "maintenance" &&
      (await isStillAvailable(admin, c.id, input.check_in, input.check_out))
    ) {
      roomId = c.id;
    }
  }
  if (!roomId) {
    roomId = await findAvailableRoom(admin, roomType.id, input.check_in, input.check_out);
  }
  if (!roomId) bail("No rooms available for those dates");

  // Resolve guest profile — reuse stub-by-email, else create stub
  let guestId: string;
  if (input.guest_email) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", input.guest_email)
      .maybeSingle();
    if (existing) {
      guestId = (existing as { id: string }).id;
      // Backfill phone / name if missing
      await admin
        .from("profiles")
        .update({ phone: input.guest_phone, full_name: input.guest_name })
        .eq("id", guestId);
    } else {
      const { data: stub, error } = await admin
        .from("profiles")
        .insert({
          full_name: input.guest_name,
          email: input.guest_email,
          phone: input.guest_phone,
          role: "guest",
          is_stub: true,
        })
        .select("id")
        .single();
      if (error) bail(friendlyDbError(error));
      guestId = (stub as { id: string }).id;
    }
  } else {
    const { data: stub, error } = await admin
      .from("profiles")
      .insert({
        full_name: input.guest_name,
        phone: input.guest_phone,
        role: "guest",
        is_stub: true,
      })
      .select("id")
      .single();
    if (error) bail(friendlyDbError(error));
    guestId = (stub as { id: string }).id;
  }

  // Insert booking
  const paid = input.payment_status === "paid";
  const status =
    input.initial_status === "checked_in"
      ? "checked_in"
      : "confirmed";
  const insertPayload: TablesInsert<"bookings"> = {
    guest_id: guestId,
    guest_name: input.guest_name,
    guest_email: input.guest_email ?? `walkin-${guestId}@example.invalid`,
    guest_phone: input.guest_phone,
    room_id: roomId,
    check_in: input.check_in,
    check_out: input.check_out,
    guests_count: input.guests_count,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    service_amount: totals.serviceAmount,
    total_amount: totals.total,
    paid_amount: paid ? totals.total : 0,
    status,
    payment_status: paid ? "paid" : "unpaid",
    payment_method: input.payment_method,
    verification_method: "staff_call",
    verified_by: a.id,
    special_requests: input.special_requests ?? null,
    ...(status === "checked_in" ? { checked_in_at: new Date().toISOString() } : {}),
  };

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert(insertPayload)
    .select("id, booking_code")
    .single();
  if (bookingErr) {
    // 23P01 = the no-overlap constraint fired: the room was taken between the
    // availability check and this insert. Anything else stays server-side.
    bail(
      bookingErr.code === "23P01"
        ? "That room was just taken for those dates — pick a different room type or dates."
        : friendlyDbError(bookingErr, "Couldn't create the booking. Please try again."),
    );
  }
  const bookingId = (booking as { id: string; booking_code: string }).id;

  // Optional payment row
  if (paid) {
    await admin.from("payments").insert({
      booking_id: bookingId,
      amount: totals.total,
      method: input.payment_method,
      provider: input.payment_provider ?? "cash",
      transaction_id: input.payment_reference ?? null,
      status: "paid",
      completed_at: new Date().toISOString(),
    });
  }

  // If staff also checked them in, flip the room status
  if (status === "checked_in") {
    await admin.from("rooms").update({ status: "occupied" }).eq("id", roomId);
  }

  await writeAudit({
    action: "create",
    entityType: "bookings",
    entityId: bookingId,
    newValues: insertPayload,
  });

  await notifyStaff({
    type: "staff_new_booking",
    vars: {
      guest_name: input.guest_name,
      booking_code: (booking as { booking_code: string }).booking_code,
      room_name: roomType.name,
      check_in: input.check_in,
      check_out: input.check_out,
    },
    data: { booking_ids: [bookingId], source: "walk_in" },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  redirect(`/booking/${bookingId}`);
}
