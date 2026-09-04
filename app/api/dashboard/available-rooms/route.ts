import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAvailableRooms } from "@/lib/availability";

export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Available rooms of a type for a date range — feeds the walk-in form's
 * room-number picker. Staff-only; reads via the admin client after the
 * session role check so it sees every room regardless of RLS.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", auth.user.id)
    .single();
  const p = profile as { role?: string; is_active?: boolean } | null;
  if (!p || !p.role || !STAFF_ROLES.has(p.role) || p.is_active === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const typeId = sp.get("type_id") ?? "";
  const checkIn = sp.get("check_in") ?? "";
  const checkOut = sp.get("check_out") ?? "";
  if (!UUID_RE.test(typeId) || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const rooms = await listAvailableRooms(admin, typeId, checkIn, checkOut);
  return NextResponse.json({ rooms });
}
