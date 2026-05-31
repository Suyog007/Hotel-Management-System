"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { sendTemplatedEmail } from "@/lib/email-from-template";
import type { TablesUpdate, Enums } from "@/types/database";

const MANAGER_PLUS = new Set(["manager", "super_admin"]);

const refundSchema = z.object({
  id: z.string().uuid(),
  refunded_amount: z.coerce.number().min(0).max(1_000_000_000),
  refund_reference: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(500).optional(),
});

export async function recordRefund(formData: FormData) {
  const parsed = refundSchema.safeParse({
    id: formData.get("id"),
    refunded_amount: formData.get("refunded_amount"),
    refund_reference: formData.get("refund_reference"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    redirect(
      `/dashboard/cancellations?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
    );
  }
  const { id, refunded_amount, refund_reference } = parsed.data;

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/cancellations");

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const role = (actor as { role: string } | null)?.role ?? "guest";
  if (!MANAGER_PLUS.has(role)) {
    redirect(`/dashboard/cancellations?error=${encodeURIComponent("Manager access required")}`);
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();
  const b = booking as Record<string, unknown> | null;
  if (!b) redirect("/dashboard/cancellations?error=Not+found");
  if (b.status !== "cancelled") {
    redirect(`/dashboard/cancellations?error=${encodeURIComponent("Booking is not cancelled")}`);
  }
  if (b.refunded_at) {
    redirect(`/dashboard/cancellations?error=${encodeURIComponent("Refund already recorded")}`);
  }

  const total = Number(b.total_amount ?? 0);
  const newPaymentStatus =
    refunded_amount === 0
      ? (b.payment_status as string)
      : refunded_amount >= total
        ? "refunded"
        : "partially_refunded";

  const update: TablesUpdate<"bookings"> = {
    refunded_amount,
    refund_reference,
    refunded_at: new Date().toISOString(),
    payment_status: newPaymentStatus as Enums<"payment_status">,
  };
  const { error } = await supabase.from("bookings").update(update).eq("id", id);
  if (error) {
    redirect(`/dashboard/cancellations?error=${encodeURIComponent(error.message)}`);
  }

  await writeAudit({
    action: "refund_recorded",
    entityType: "bookings",
    entityId: id,
    oldValues: {
      refunded_amount: b.refunded_amount,
      refund_reference: b.refund_reference,
      payment_status: b.payment_status,
    },
    newValues: update,
  });

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";
  await sendTemplatedEmail("booking_refunded", b.guest_email as string, {
    guest_name: (b.guest_name as string) ?? "",
    booking_code: (b.booking_code as string) ?? "",
    refunded_amount: refunded_amount.toLocaleString(),
    refund_reference,
    currency_symbol: symbol,
  });

  revalidatePath("/dashboard/cancellations");
  revalidatePath(`/booking/${id}`);
  redirect("/dashboard/cancellations?saved=1");
}
