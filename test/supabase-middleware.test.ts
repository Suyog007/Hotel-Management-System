import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "./stubs/fake-supabase";

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => h.client,
}));

import { updateSession } from "@/lib/supabase/middleware";

function req(path: string) {
  return new NextRequest(new Request(`http://localhost:4000${path}`));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("updateSession", () => {
  it("returns user=null, role=null when there is no session", async () => {
    h.client = createFakeSupabase({ profiles: [] }, { user: null });
    const { user, role, isActive } = await updateSession(req("/dashboard"));
    expect(user).toBeNull();
    expect(role).toBeNull();
    expect(isActive).toBe(true);
  });

  it("resolves role and is_active from the profile linked to the session user", async () => {
    h.client = createFakeSupabase(
      { profiles: [{ auth_user_id: "u1", role: "manager", is_active: true }] },
      { user: { id: "u1", email: "m@x.com" } },
    );
    const { user, role, isActive } = await updateSession(req("/dashboard"));
    expect(user).toMatchObject({ id: "u1" });
    expect(role).toBe("manager");
    expect(isActive).toBe(true);
  });

  it("surfaces is_active=false from the profile", async () => {
    h.client = createFakeSupabase(
      { profiles: [{ auth_user_id: "u1", role: "receptionist", is_active: false }] },
      { user: { id: "u1" } },
    );
    const { role, isActive } = await updateSession(req("/dashboard"));
    expect(role).toBe("receptionist");
    expect(isActive).toBe(false);
  });

  it("defaults role to null and isActive to true when the user has no profile row", async () => {
    h.client = createFakeSupabase({ profiles: [] }, { user: { id: "orphan" } });
    const { role, isActive } = await updateSession(req("/dashboard"));
    expect(role).toBeNull();
    expect(isActive).toBe(true);
  });

  it("throws when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(updateSession(req("/"))).rejects.toThrow(/Missing NEXT_PUBLIC_SUPABASE_URL/);
  });
});
