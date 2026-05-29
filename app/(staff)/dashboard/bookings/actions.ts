"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);

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
