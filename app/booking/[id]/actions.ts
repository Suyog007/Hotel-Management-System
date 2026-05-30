"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { computeRefund, type CancellationTier } from "@/lib/cancellation";
import { sendTemplatedEmail } from "@/lib/email-from-template";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);
const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

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
  if (!CANCELLABLE_STATUSES.has(b.status as string)) {
    const tail = isTokenHolder ? `?t=${token}` : "";
    redirect(`/booking/${id}${tail}&error=${encodeURIComponent("This booking can't be cancelled.")}`.replace("?t=", tail ? "?t=" : "?"));
  }

  const { data: tiers } = await admin
    .from("cancellation_policy")
    .select("id, hours_before_checkin, refund_percentage, label")
    .order("hours_before_checkin", { ascending: false });

  const refund = computeRefund({
    paidAmount: Number(b.paid_amount ?? 0),
    checkIn: b.check_in as string,
    tiers: (tiers as CancellationTier[] | null) ?? [],
  });

  const updatePayload = {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_by: actorId,
    cancellation_reason: reason,
    refund_amount_due: refund.refundAmount,
  };
  const { error } = await admin
    .from("bookings")
    .update(updatePayload)
    .eq("id", id);
  if (error) {
    const tail = isTokenHolder ? `?t=${token}&` : "?";
    redirect(`/booking/${id}${tail}error=${encodeURIComponent(error.message)}`);
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

  revalidatePath(`/booking/${id}`);
  revalidatePath("/my-bookings");
  revalidatePath("/dashboard/cancellations");
  const tail = isTokenHolder ? `?t=${token}&cancelled=1` : "?cancelled=1";
  redirect(`/booking/${id}${tail}`);
}

