"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { friendlyDbError } from "@/lib/friendly-error";
import { isStillAvailable } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween, TAX_RATE, SERVICE_CHARGE_RATE } from "@/lib/pricing";
import type { TablesUpdate } from "@/types/database";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);
const MANAGER_ROLES = new Set(["manager", "super_admin"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function staffActor() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/bookings");
  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("auth_user_id", auth.user.id)
    .single();
  const a = actor as { id: string; role: string; is_active: boolean | null } | null;
  if (!a || !STAFF_ROLES.has(a.role) || a.is_active === false) {
    redirect(`/?error=${encodeURIComponent("Staff access required")}`);
  }
  return a;
}

// Where an action returns after it finishes. The bookings list is the default;
// the room-map booking-detail page passes its own path via `redirect_to` so
// staff stay put after acting. Only same-area dashboard paths are honoured —
// never an off-site or attacker-supplied URL.
function returnBase(formData: FormData): string {
  const raw = ((formData.get("redirect_to") as string | null) ?? "").trim();
  return /^\/dashboard\/[A-Za-z0-9/_-]*$/.test(raw) ? raw : "/dashboard/bookings";
}

function bailTo(base: string, msg: string): never {
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}error=${encodeURIComponent(msg)}`);
}

export async function checkIn(formData: FormData) {
  const base = returnBase(formData);
  const id = formData.get("id") as string;
  if (!id) bailTo(base, "Missing id");
  await staffActor();

  const supabase = await createServerClient();
  const admin = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("status, room_id, booking_code")
    .eq("id", id)
    .single();
  const b = booking as { status: string; room_id: string; booking_code: string } | null;
  if (!b) bailTo(base, "Booking not found");
  if (b.status !== "pending" && b.status !== "confirmed") {
    bailTo(base, `Cannot check in a ${b.status} booking`);
  }

  const now = new Date().toISOString();
  const { error: e1 } = await admin
    .from("bookings")
    .update({ status: "checked_in", checked_in_at: now })
    .eq("id", id);
  if (e1) bailTo(base, friendlyDbError(e1, "Couldn't check the guest in. Please try again."));

  const { error: e2 } = await admin
    .from("rooms")
    .update({ status: "occupied" })
    .eq("id", b.room_id);
  if (e2) bailTo(base, friendlyDbError(e2, "Guest checked in, but the room status didn't update."));

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
  revalidatePath(`/dashboard/bookings/${id}`);
  redirect(`${base}${base.includes("?") ? "&" : "?"}saved=1`);
}

const PAYMENT_PROVIDERS = new Set(["cash", "khalti", "esewa"]);

/**
 * Check a guest out, optionally settling the outstanding balance in the same
 * step (pay-at-hotel guests settle at the desk on the way out). When the form
 * carries `collect=1` and the booking still owes money, the outstanding amount
 * is recorded as paid: `paid_amount` topped up, `payment_status` → paid, and a
 * `payments` row inserted — the same shape the walk-in flow writes.
 */
export async function checkOut(formData: FormData) {
  const base = returnBase(formData);
  const id = formData.get("id") as string;
  if (!id) bailTo(base, "Missing id");
  await staffActor();

  const collect = formData.get("collect") === "1";
  const providerRaw = ((formData.get("payment_provider") as string) || "cash").trim();
  const provider = PAYMENT_PROVIDERS.has(providerRaw) ? providerRaw : null;
  if (collect && !provider) bailTo(base, "Pick a valid payment method (cash / Khalti / eSewa)");
  const reference =
    (((formData.get("payment_reference") as string) || "").trim() || null)?.slice(0, 200) ?? null;

  const supabase = await createServerClient();
  const admin = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "status, room_id, booking_code, guest_email, guest_name, total_amount, paid_amount, payment_status, payment_method",
    )
    .eq("id", id)
    .single();
  const b = booking as {
    status: string;
    room_id: string;
    booking_code: string;
    guest_email: string;
    guest_name: string;
    total_amount: number | string;
    paid_amount: number | string | null;
    payment_status: string;
    payment_method: "pay_at_hotel" | "online";
  } | null;
  if (!b) bailTo(base, "Booking not found");
  if (b.status !== "checked_in") bailTo(base, `Cannot check out a ${b.status} booking`);

  const outstanding = Math.max(0, Number(b.total_amount) - Number(b.paid_amount ?? 0));
  const settling = collect && outstanding > 0;

  const now = new Date().toISOString();
  const payload: TablesUpdate<"bookings"> = {
    status: "checked_out",
    checked_out_at: now,
    ...(settling
      ? { paid_amount: Number(b.total_amount), payment_status: "paid" as const }
      : {}),
  };
  const { error: e1 } = await admin.from("bookings").update(payload).eq("id", id);
  if (e1) bailTo(base, friendlyDbError(e1, "Couldn't check the guest out. Please try again."));

  if (settling) {
    const { error: payErr } = await admin.from("payments").insert({
      booking_id: id,
      amount: outstanding,
      method: b.payment_method,
      provider: provider as "cash" | "khalti" | "esewa",
      transaction_id: reference,
      status: "paid",
      completed_at: now,
    });
    // The booking is already marked paid — a failed ledger row must not strand
    // the guest mid-checkout, but it has to be visible somewhere.
    if (payErr) {
      console.error("[checkOut] payments insert failed:", payErr.message);
    }
  }

  const { error: e2 } = await admin
    .from("rooms")
    .update({ status: "cleaning" })
    .eq("id", b.room_id);
  if (e2) bailTo(base, friendlyDbError(e2, "Guest checked out, but the room status didn't update — set it on the Rooms page."));

  await writeAudit({
    action: "update",
    entityType: "bookings",
    entityId: id,
    oldValues: {
      status: b.status,
      payment_status: b.payment_status,
      paid_amount: b.paid_amount ?? 0,
    },
    newValues: {
      status: "checked_out",
      checked_out_at: now,
      room_status: "cleaning",
      ...(settling
        ? { payment_status: "paid", collected: outstanding, provider, reference }
        : {}),
    },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  revalidatePath(`/booking/${id}`);
  revalidatePath(`/dashboard/bookings/${id}`);
  const sep = base.includes("?") ? "&" : "?";
  redirect(settling ? `${base}${sep}saved=1&collected=${outstanding}` : `${base}${sep}saved=1`);
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
  const base = returnBase(formData);
  const id = formData.get("id") as string;
  const newCheckOut = (formData.get("new_check_out") as string | null)?.trim() ?? "";
  if (!id) bailTo(base, "Missing booking id");
  if (!ISO_DATE.test(newCheckOut)) bailTo(base, "Pick a valid new check-out date");

  const actor = await staffActor();
  if (!MANAGER_ROLES.has(actor.role)) {
    bailTo(base, "Manager access required to extend a stay");
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "status, room_id, check_in, check_out, subtotal, tax_amount, service_amount, total_amount, paid_amount, payment_status, guest_email, guest_name, booking_code",
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
    paid_amount: number | string | null;
    payment_status: string;
    guest_email: string;
    guest_name: string;
    booking_code: string;
  } | null;
  if (!b) bailTo(base, "Booking not found");
  if (b.status !== "confirmed" && b.status !== "checked_in") {
    bailTo(base, `Cannot extend a ${b.status} booking`);
  }
  if (new Date(newCheckOut) <= new Date(b.check_out)) {
    bailTo(base, "New check-out must be after the current check-out");
  }

  // Verify same-room availability for the gap [current_check_out, new_check_out).
  // The current booking ends exactly at b.check_out, so the gap range does not
  // overlap with itself — only other bookings would be flagged.
  const free = await isStillAvailable(admin, b.room_id, b.check_out, newCheckOut);
  if (!free) {
    bailTo(
      base,
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
  if (!basePrice) bailTo(base, "Could not read the room's base price");

  // Room rate only — no tax or service charge (see lib/pricing constants).
  const taxRate = TAX_RATE;
  const serviceRate = SERVICE_CHARGE_RATE;

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

  // Extending raises the total, so a booking that was fully paid now has a
  // balance due. The payment_status enum has no "partially paid" state, so the
  // truthful representation within the model is "unpaid" (balance outstanding);
  // paid_amount still records what was collected. Only flip the settled "paid"
  // case — leave unpaid/failed/refunded states as they are.
  const paid = Number(b.paid_amount ?? 0);
  const payload: TablesUpdate<"bookings"> = {
    check_out: newCheckOut,
    subtotal: newSubtotal,
    tax_amount: newTax,
    service_amount: newService,
    total_amount: newTotal,
  };
  if (b.payment_status === "paid" && paid < newTotal) {
    payload.payment_status = "unpaid";
  }

  const { error } = await admin.from("bookings").update(payload).eq("id", id);
  if (error) bailTo(base, friendlyDbError(error, "Couldn't extend the stay. Please try again."));

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
  revalidatePath(`/dashboard/bookings/${id}`);
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}saved=1&extended=${b.booking_code}&nights=${extraNights}`);
}

export async function markRoomReady(formData: FormData) {
  const base = returnBase(formData);
  const roomId = formData.get("room_id") as string;
  if (!roomId) bailTo(base, "Missing room id");
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
  if (error) bailTo(base, friendlyDbError(error, "Couldn't update the room. Please try again."));

  await writeAudit({
    action: "update",
    entityType: "rooms",
    entityId: roomId,
    oldValues: oldRoom,
    newValues: { status: "available" },
  });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}saved=1`);
}
