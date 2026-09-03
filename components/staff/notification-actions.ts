"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

/** Mark every unread notification of the signed-in staff member as read.
 *  RLS ("notifications self update") scopes the write to their own rows. */
export async function markAllNotificationsRead() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .single();
  if (profileErr) {
    console.error("[notifications] profile lookup failed:", profileErr.message);
    return;
  }
  const profileId = (profile as { id: string } | null)?.id;
  if (!profileId) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profileId)
    .is("read_at", null);
  if (error) {
    console.error("[notifications] mark-all-read failed:", error.message);
    return;
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}
