import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (auth.user) {
    await writeAudit({
      action: "logout",
      entityType: "auth.users",
      entityId: auth.user.id,
    });
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
