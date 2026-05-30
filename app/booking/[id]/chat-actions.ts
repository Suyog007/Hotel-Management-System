"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);

/**
 * Sends a chat message from a guest viewing their own booking. Auth is
 * either:
 *   - a Supabase session whose profile.id matches booking.guest_id, OR
 *   - an `access_token` form field that matches booking.access_token
 * Staff sessions are also allowed (they may reply on behalf of the guest from
 * the booking page, though they normally use /dashboard/chat).
 *
 * The conversation is keyed on the booking's guest_id. Same guest with two
 * bookings shares one thread — that's intentional.
 */
export async function sendBookingChatMessage(formData: FormData) {
  const bookingId = (formData.get("booking_id") as string | null)?.trim() ?? "";
  const token = (formData.get("access_token") as string | null)?.trim() ?? "";
  const body = ((formData.get("body") as string | null) ?? "").trim();

  if (!UUID_RE.test(bookingId)) redirect("/?error=Invalid+booking");
  if (!body) redirect(`/booking/${bookingId}${token ? `?t=${token}` : ""}`);
  if (body.length > 4000) {
    redirect(
      `/booking/${bookingId}?${token ? `t=${token}&` : ""}chat_error=Message+too+long`,
    );
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, guest_id, access_token")
    .eq("id", bookingId)
    .single();
  const b = booking as {
    id: string;
    guest_id: string;
    access_token: string;
  } | null;
  if (!b) redirect("/?error=Booking+not+found");

  // Authorization: token match, or signed-in owner, or signed-in staff.
  let senderId: string = b.guest_id;
  let senderRole: "guest" | "receptionist" | "manager" | "super_admin" = "guest";
  let authorized = false;

  if (token && UUID_RE.test(token) && token === b.access_token) {
    authorized = true; // anonymous token-holder = guest themselves
  } else {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("auth_user_id", auth.user.id)
        .single();
      const p = profile as { id: string; role: string } | null;
      if (p) {
        if (p.id === b.guest_id) {
          authorized = true;
        } else if (STAFF_ROLES.has(p.role)) {
          authorized = true;
          senderId = p.id;
          senderRole = p.role as typeof senderRole;
        }
      }
    }
  }

  if (!authorized) {
    redirect(`/?error=${encodeURIComponent("Not authorized to chat on this booking")}`);
  }

  // Find-or-create the guest's conversation. We always key on the booking's
  // guest_id so the thread is consistent regardless of who's sending.
  let conversationId: string;
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("guest_id", b.guest_id)
    .maybeSingle();
  if (existing) {
    conversationId = (existing as { id: string }).id;
  } else {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ guest_id: b.guest_id })
      .select("id")
      .single();
    if (error) {
      redirect(
        `/booking/${bookingId}?${token ? `t=${token}&` : ""}chat_error=${encodeURIComponent(error.message)}`,
      );
    }
    conversationId = (created as { id: string }).id;
  }

  const { error: insertErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    sender_role: senderRole,
    body,
  });
  if (insertErr) {
    redirect(
      `/booking/${bookingId}?${token ? `t=${token}&` : ""}chat_error=${encodeURIComponent(insertErr.message)}`,
    );
  }

  revalidatePath(`/booking/${bookingId}`);
  revalidatePath("/dashboard/chat");
  revalidatePath(`/dashboard/chat/${conversationId}`);

  redirect(`/booking/${bookingId}${token ? `?t=${token}` : ""}#chat`);
}
