import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);

export async function middleware(request: NextRequest) {
  const { response, user, role, isActive } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // /admin/** is super_admin only
  if (pathname.startsWith("/admin")) {
    if (!user) return redirectToLogin(request);
    if (role !== "super_admin" || !isActive) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // /dashboard/** is any staff role
  if (pathname.startsWith("/dashboard")) {
    if (!user) return redirectToLogin(request);
    if (!role || !STAFF_ROLES.has(role) || !isActive) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
