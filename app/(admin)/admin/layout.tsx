import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { BackOfficeNav } from "@/components/shared/back-office-nav";
import { ResponsiveShell } from "@/components/shell/responsive-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  if ((profile?.role as string | undefined) !== "super_admin") redirect("/");

  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotelName = (settings?.hotel_name as string) ?? "Admin";

  return (
    <ResponsiveShell
      sidebar={<BackOfficeNav hotelName={hotelName} role="super_admin" />}
      brand={hotelName}
    >
      {children}
    </ResponsiveShell>
  );
}
