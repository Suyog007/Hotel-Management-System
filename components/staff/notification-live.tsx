import { createServerClient } from "@/lib/supabase/server";
import { NotificationListener } from "./notification-listener";

/**
 * Server wrapper that resolves the signed-in staff member's profile id and
 * mounts the realtime notification listener. Render exactly once per
 * back-office layout (dashboard, admin) — see NotificationListener's doc.
 */
export async function NotificationListenerArea() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .single();
  const profileId = (profile as { id: string } | null)?.id;
  if (!profileId) return null;

  return <NotificationListener profileId={profileId} />;
}
