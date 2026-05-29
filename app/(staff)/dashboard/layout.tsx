import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { BackOfficeNav } from "@/components/shared/back-office-nav";
import { ResponsiveShell } from "@/components/shell/responsive-shell";

type Role = "receptionist" | "manager" | "super_admin";
const STAFF_ROLES: Role[] = ["receptionist", "manager", "super_admin"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const role = (profile?.role as Role | undefined) ?? ("guest" as unknown as Role);
  if (!STAFF_ROLES.includes(role)) redirect("/");

  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotelName = (settings?.hotel_name as string) ?? "Staff";

  return (
    <ResponsiveShell
      sidebar={<BackOfficeNav hotelName={hotelName} role={role} />}
      brand={hotelName}
    >
      {children}
    </ResponsiveShell>
  );
}
