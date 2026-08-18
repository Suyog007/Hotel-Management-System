import { createServerClient } from "@/lib/supabase/server";
import { NotificationBell, type NotificationItem } from "./notification-bell";

/** Fetches the signed-in staff member's latest notifications and renders the
 *  bell. RLS ("notifications self read") already scopes rows to the user, but
 *  we still resolve the profile so a signed-out render costs nothing. */
export async function NotificationBellArea() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  const items = (data as NotificationItem[] | null) ?? [];
  return <NotificationBell items={items} />;
}
