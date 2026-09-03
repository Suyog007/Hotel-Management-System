"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { computeRefund, type CancellationTier } from "@/lib/cancellation";
import { sendTemplatedEmail } from "@/lib/email-from-template";
import { notifyStaff } from "@/lib/notify-staff";
import { friendlyDbError } from "@/lib/friendly-error";
import type { TablesUpdate } from "@/types/database";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);
const CANCELLABLE_STATUSES = ["pending", "confirmed"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cancelBooking(formData: FormData) {
  const id = formData.get("id") as string;
  const token = ((formData.get("token") as string) || "").trim() || null;
  const reason = ((formData.get("reason") as string) ?? "").trim() || null;
  if (!id) redirect("/?error=Missing+id");

  const admin = createAdminClient();
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();

  // Fetch booking via admin client so we can authorize uniformly.
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();
  const b = booking as Record<string, unknown> | null;
  if (!b) redirect(`/?error=${encodeURIComponent("Booking not found")}`);

  // Authorization paths:
  //   1. Signed-in owner (profile.id === booking.guest_id) OR signed-in staff
  //   2. Anonymous guest holding the booking.access_token
  let actorId: string | null = null;
  let actorRole = "guest";
  let isOwner = false;
  let isStaff = false;
  let isTokenHolder = false;

  if (auth.user) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_user_id", auth.user.id)
      .single();
    const a = actor as { id: string; role: string } | null;
    if (a) {
      actorId = a.id;
      actorRole = a.role;
      isOwner = b.guest_id === a.id;
      isStaff = STAFF_ROLES.has(a.role);
    }
  }
  if (!isOwner && !isStaff && token && UUID_RE.test(token)) {
    isTokenHolder = token === (b.access_token as string);
  }

  if (!isOwner && !isStaff && !isTokenHolder) {
    redirect(`/?error=${encodeURIComponent("Not authorized to cancel that booking.")}`);
  }
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(b.status as string)) {
    const tail = isTokenHolder ? `?t=${token}&` : "?";
    redirect(
      `/booking/${id}${tail}error=${encodeURIComponent("This booking can't be cancelled.")}`,
    );
  }

  const { data: tiers, error: tiersError } = await admin
    .from("cancellation_policy")
    .select("id, hours_before_checkin, refund_percentage, label")
    .order("hours_before_checkin", { ascending: false });

  // Never silently proceed with an empty policy: computeRefund would return 0,
  // recording a wrong "no refund" for a guest who actually paid. Fail loudly so
  // the cancellation can be retried once the policy read succeeds.
  if (tiersError) {
    const tail = isTokenHolder ? `?t=${token}&` : "?";
    redirect(`/booking/${id}${tail}error=${encodeURIComponent("Couldn't load the refund policy. Please try again.")}`);
  }

  const refund = computeRefund({
    paidAmount: Number(b.paid_amount ?? 0),
    checkIn: b.check_in as string,
    tiers: (tiers as CancellationTier[] | null) ?? [],
  });

  const updatePayload: TablesUpdate<"bookings"> = {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_by: actorId,
    cancellation_reason: reason,
    refund_amount_due: refund.refundAmount,
  };
  // Re-assert the status in the UPDATE predicate so a booking that was
  // checked-in (or cancelled) between the read above and this write can't be
  // flipped to cancelled. A zero-row result means the state changed under us.
  const { data: cancelled, error } = await admin
    .from("bookings")
    .update(updatePayload)
    .eq("id", id)
    .in("status", [...CANCELLABLE_STATUSES])
    .select("id");
  if (error) {
    const tail = isTokenHolder ? `?t=${token}&` : "?";
    redirect(
      `/booking/${id}${tail}error=${encodeURIComponent(friendlyDbError(error, "Couldn't cancel the booking. Please try again."))}`,
    );
  }
  if (!cancelled || cancelled.length === 0) {
    const tail = isTokenHolder ? `?t=${token}&` : "?";
    redirect(
      `/booking/${id}${tail}error=${encodeURIComponent("This booking can no longer be cancelled.")}`,
    );
  }

  await writeAudit({
    action: "delete",
    entityType: "bookings",
    entityId: id,
    oldValues: { status: b.status, refund_amount_due: b.refund_amount_due ?? null },
    newValues: { ...updatePayload, tier: refund.tier?.label ?? null, actor: isTokenHolder ? "guest_token" : actorRole },
  });

  const { data: settings } = await admin
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";
  await sendTemplatedEmail("booking_cancelled", b.guest_email as string, {
    guest_name: (b.guest_name as string) ?? "",
    booking_code: (b.booking_code as string) ?? "",
    refund_amount_due: refund.refundAmount.toLocaleString(),
    currency_symbol: symbol,
  });

  await notifyStaff({
    type: "staff_cancellation",
    vars: {
      guest_name: (b.guest_name as string) ?? "Guest",
      booking_code: (b.booking_code as string) ?? "",
      check_in: (b.check_in as string) ?? "",
      refund_amount_due: `${symbol} ${refund.refundAmount.toLocaleString()}`,
    },
    data: { booking_ids: [id], actor: isTokenHolder ? "guest_token" : actorRole },
  });

  revalidatePath(`/booking/${id}`);
  revalidatePath("/my-bookings");
  revalidatePath("/dashboard/cancellations");
  const tail = isTokenHolder ? `?t=${token}&cancelled=1` : "?cancelled=1";
  redirect(`/booking/${id}${tail}`);
}

