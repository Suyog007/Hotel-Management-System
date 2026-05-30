"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { isStillAvailable } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween } from "@/lib/pricing";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);
const MANAGER_ROLES = new Set(["manager", "super_admin"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function staffActor() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/bookings");
  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const a = actor as { id: string; role: string } | null;
  if (!a || !STAFF_ROLES.has(a.role)) {
    redirect(`/?error=${encodeURIComponent("Staff access required")}`);
  }
  return a;
}

function bail(msg: string): never {
  redirect(`/dashboard/bookings?error=${encodeURIComponent(msg)}`);
}

export async function checkIn(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) bail("Missing id");
  await staffActor();

  const supabase = await createServerClient();
  const admin = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("status, room_id, booking_code")
    .eq("id", id)
    .single();
  const b = booking as { status: string; room_id: string; booking_code: string } | null;
  if (!b) bail("Booking not found");
  if (b.status !== "pending" && b.status !== "confirmed") {
    bail(`Cannot check in a ${b.status} booking`);
  }

  const now = new Date().toISOString();
  const { error: e1 } = await admin
    .from("bookings")
    .update({ status: "checked_in", checked_in_at: now })
    .eq("id", id);
  if (e1) bail(e1.message);

  const { error: e2 } = await admin
    .from("rooms")
    .update({ status: "occupied" })
    .eq("id", b.room_id);
  if (e2) bail(e2.message);

  await writeAudit({
    action: "update",
    entityType: "bookings",
    entityId: id,
    oldValues: { status: b.status },
    newValues: { status: "checked_in", checked_in_at: now, room_status: "occupied" },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  revalidatePath(`/booking/${id}`);
  redirect("/dashboard/bookings?saved=1");
}

export async function checkOut(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) bail("Missing id");
  await staffActor();

  const supabase = await createServerClient();
  const admin = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("status, room_id, booking_code, guest_email, guest_name")
    .eq("id", id)
    .single();
  const b = booking as {
    status: string;
    room_id: string;
    booking_code: string;
    guest_email: string;
    guest_name: string;
  } | null;
  if (!b) bail("Booking not found");
  if (b.status !== "checked_in") bail(`Cannot check out a ${b.status} booking`);

  const now = new Date().toISOString();
  const { error: e1 } = await admin
    .from("bookings")
    .update({ status: "checked_out", checked_out_at: now })
    .eq("id", id);
  if (e1) bail(e1.message);

  const { error: e2 } = await admin
    .from("rooms")
    .update({ status: "cleaning" })
    .eq("id", b.room_id);
  if (e2) bail(e2.message);

  await writeAudit({
    action: "update",
    entityType: "bookings",
    entityId: id,
    oldValues: { status: b.status },
    newValues: { status: "checked_out", checked_out_at: now, room_status: "cleaning" },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  revalidatePath(`/booking/${id}`);
  redirect("/dashboard/bookings?saved=1");
}

/**
 * Extend an active booking's check-out date. Manager+ only.
 *
 * Verifies the same room is free for the added nights (the existing
 * exclusion constraint would also catch a clash, but we pre-check so we can
 * surface a friendlier message). Pricing for the extra nights is computed
 * server-side using current base_price + tax/service rates from site_settings
 * and added to the snapshotted totals on the booking row.
 */
export async function extendStay(formData: FormData) {
  const id = formData.get("id") as string;
  const newCheckOut = (formData.get("new_check_out") as string | null)?.trim() ?? "";
  if (!id) bail("Missing booking id");
  if (!ISO_DATE.test(newCheckOut)) bail("Pick a valid new check-out date");

  const actor = await staffActor();
  if (!MANAGER_ROLES.has(actor.role)) {
    bail("Manager access required to extend a stay");
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "status, room_id, check_in, check_out, subtotal, tax_amount, service_amount, total_amount, guest_email, guest_name, booking_code",
    )
    .eq("id", id)
    .single();
  const b = booking as {
    status: string;
    room_id: string;
    check_in: string;
    check_out: string;
    subtotal: number | string;
    tax_amount: number | string;
    service_amount: number | string;
    total_amount: number | string;
    guest_email: string;
    guest_name: string;
    booking_code: string;
  } | null;
  if (!b) bail("Booking not found");
  if (b.status !== "confirmed" && b.status !== "checked_in") {
    bail(`Cannot extend a ${b.status} booking`);
  }
  if (new Date(newCheckOut) <= new Date(b.check_out)) {
    bail("New check-out must be after the current check-out");
  }

  // Verify same-room availability for the gap [current_check_out, new_check_out).
  // The current booking ends exactly at b.check_out, so the gap range does not
  // overlap with itself — only other bookings would be flagged.
  const free = await isStillAvailable(admin, b.room_id, b.check_out, newCheckOut);
  if (!free) {
    bail(
      "This room is booked by another guest in that range. Move the guest to a free room first, then try again.",
    );
  }

  // Pull the room's current base_price + site tax/service rates.
  const { data: roomRow } = await admin
    .from("rooms")
    .select("type_id, room_types:type_id(base_price)")
    .eq("id", b.room_id)
    .single();
  const basePrice = Number(
    (roomRow as { room_types?: { base_price?: number | string } } | null)
      ?.room_types?.base_price ?? 0,
  );
  if (!basePrice) bail("Could not read the room's base price");

  const { data: settings } = await admin
    .from("site_settings")
    .select("tax_rate, service_charge_rate")
    .single();
  const taxRate = Number(
    (settings as { tax_rate?: number | string } | null)?.tax_rate ?? 0,
  );
  const serviceRate = Number(
    (settings as { service_charge_rate?: number | string } | null)
      ?.service_charge_rate ?? 0,
  );

  const extraNights = nightsBetween(b.check_out, newCheckOut);
  const extra = calculateBookingTotal({
    basePrice,
    nights: extraNights,
    taxRate,
    serviceRate,
  });

  const newSubtotal = Number(b.subtotal) + extra.subtotal;
  const newTax = Number(b.tax_amount) + extra.taxAmount;
  const newService = Number(b.service_amount) + extra.serviceAmount;
  const newTotal = Number(b.total_amount) + extra.total;

  const { error } = await admin
    .from("bookings")
    .update({
      check_out: newCheckOut,
      subtotal: newSubtotal,
      tax_amount: newTax,
      service_amount: newService,
      total_amount: newTotal,
    })
    .eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "bookings",
    entityId: id,
    oldValues: {
      check_out: b.check_out,
      total_amount: Number(b.total_amount),
    },
    newValues: {
      check_out: newCheckOut,
      total_amount: newTotal,
      extra_nights: extraNights,
      extra_charged: extra.total,
    },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  revalidatePath(`/booking/${id}`);
  redirect(
    `/dashboard/bookings?saved=1&extended=${b.booking_code}&nights=${extraNights}`,
  );
}

export async function markRoomReady(formData: FormData) {
  const roomId = formData.get("room_id") as string;
  if (!roomId) bail("Missing room id");
  await staffActor();

  const admin = createAdminClient();
  const { data: oldRoom } = await admin
    .from("rooms")
    .select("status")
    .eq("id", roomId)
    .single();
  const { error } = await admin
    .from("rooms")
    .update({ status: "available" })
    .eq("id", roomId);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "rooms",
    entityId: roomId,
    oldValues: oldRoom,
    newValues: { status: "available" },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/rooms");
  redirect("/dashboard/bookings?saved=1");
}
