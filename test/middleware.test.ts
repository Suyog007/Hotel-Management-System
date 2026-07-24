import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const h = vi.hoisted(() => ({
  session: null as unknown as { response: unknown; user: unknown; role: string | null; isActive: boolean },
}));
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => h.session,
}));

import { middleware } from "@/middleware";

function req(path: string) {
  return new NextRequest(new Request(`http://localhost:4000${path}`));
}

function setSession(opts: { user?: unknown; role?: string | null; isActive?: boolean }) {
  h.session = {
    response: NextResponse.next(),
    user: opts.user ?? null,
    role: opts.role ?? null,
    isActive: opts.isActive ?? true,
  };
}

describe("middleware route guarding", () => {
  it("redirects unauthenticated visitors of /admin to /login with a next param", async () => {
    setSession({ user: null });
    const res = await middleware(req("/admin/staff"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin/staff");
  });

  it("redirects unauthenticated visitors of /dashboard to /login with a next param", async () => {
    setSession({ user: null });
    const res = await middleware(req("/dashboard/bookings"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard/bookings");
  });

  it("bounces a non-super_admin authenticated user away from /admin", async () => {
    setSession({ user: { id: "u1" }, role: "manager", isActive: true });
    const res = await middleware(req("/admin"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/");
  });

  it("bounces a disabled (is_active=false) super_admin away from /admin", async () => {
    setSession({ user: { id: "u1" }, role: "super_admin", isActive: false });
    const res = await middleware(req("/admin/settings"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/");
  });

  it("bounces a guest (non-staff role) away from /dashboard", async () => {
    setSession({ user: { id: "u1" }, role: "guest", isActive: true });
    const res = await middleware(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/");
  });

  it("bounces a disabled staff member away from /dashboard", async () => {
    setSession({ user: { id: "u1" }, role: "receptionist", isActive: false });
    const res = await middleware(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/");
  });

  it("lets an active super_admin through to /admin", async () => {
    setSession({ user: { id: "u1" }, role: "super_admin", isActive: true });
    const res = await middleware(req("/admin/staff"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets an active receptionist through to /dashboard", async () => {
    setSession({ user: { id: "u1" }, role: "receptionist", isActive: true });
    const res = await middleware(req("/dashboard/bookings"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets anyone through on public routes regardless of session state", async () => {
    setSession({ user: null });
    const res = await middleware(req("/rooms"));
    expect(res.headers.get("location")).toBeNull();
  });
});
