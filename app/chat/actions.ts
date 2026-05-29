"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

export async function sendGuestMessage(formData: FormData) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/chat");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const p = profile as { id: string; role: string } | null;
  if (!p) redirect("/");

  const body = ((formData.get("body") as string) ?? "").trim();
  if (!body) redirect("/chat");
  if (body.length > 4000) redirect("/chat?error=Message+too+long");

  // Find or create the guest's conversation
  let conversationId = (formData.get("conversation_id") as string) || null;
  if (!conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("guest_id", p.id)
      .maybeSingle();
    if (existing) {
      conversationId = (existing as { id: string }).id;
    } else {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ guest_id: p.id })
        .select("id")
        .single();
      if (error) redirect(`/chat?error=${encodeURIComponent(error.message)}`);
      conversationId = (created as { id: string }).id;
    }
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: p.id,
    sender_role: "guest",
    body,
  });
  if (error) redirect(`/chat?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/chat");
  revalidatePath("/dashboard/chat");
  if (conversationId) revalidatePath(`/dashboard/chat/${conversationId}`);
}
