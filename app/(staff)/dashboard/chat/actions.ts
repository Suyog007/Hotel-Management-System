"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);

export async function sendStaffMessage(formData: FormData) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/chat");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const p = profile as { id: string; role: string } | null;
  if (!p || !STAFF_ROLES.has(p.role)) redirect("/?error=Staff+only");

  const conversationId = formData.get("conversation_id") as string | null;
  if (!conversationId) redirect("/dashboard/chat?error=Missing+conversation");

  const body = ((formData.get("body") as string) ?? "").trim();
  if (!body) redirect(`/dashboard/chat/${conversationId}`);
  if (body.length > 4000) {
    redirect(`/dashboard/chat/${conversationId}?error=Message+too+long`);
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: p.id,
    sender_role: p.role,
    body,
  });
  if (error) {
    redirect(`/dashboard/chat/${conversationId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/chat/${conversationId}`);
  revalidatePath("/dashboard/chat");
}
