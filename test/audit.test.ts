import { describe, it, expect, vi } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";

const h = vi.hoisted(() => ({ server: null as unknown, admin: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));

import { writeAudit } from "@/lib/audit";

function setup(opts: { user?: { id: string; email?: string } | null; profile?: Record<string, unknown> } = {}) {
  const adminTables: Record<string, Record<string, unknown>[]> = { audit_logs: [] };
  const serverTables: Record<string, Record<string, unknown>[]> = {
    profiles: opts.profile ? [opts.profile] : [],
  };
  h.server = createFakeSupabase(serverTables, { user: opts.user ?? null });
  h.admin = createFakeSupabase(adminTables);
  return { adminTables };
}

describe("writeAudit", () => {
  it("resolves the actor from the session profile and inserts via the service-role client", async () => {
    const { adminTables } = setup({
      user: { id: "auth-1", email: "auth@x.com" },
      profile: { id: "profile-1", auth_user_id: "auth-1", email: "profile@x.com" },
    });

    await writeAudit({
      action: "login",
      entityType: "auth.users",
      entityId: "auth-1",
      newValues: { role: "guest" },
    });

    expect(adminTables.audit_logs).toHaveLength(1);
    expect(adminTables.audit_logs[0]).toMatchObject({
      actor_id: "profile-1",
      actor_email: "profile@x.com",
      action: "login",
      entity_type: "auth.users",
      entity_id: "auth-1",
      new_values: { role: "guest" },
    });
  });

  it("falls back to the auth user's own email when no profile row is found", async () => {
    const { adminTables } = setup({ user: { id: "auth-2", email: "fallback@x.com" } });

    await writeAudit({ action: "update", entityType: "bookings", entityId: "b1" });

    expect(adminTables.audit_logs[0]).toMatchObject({
      actor_id: null,
      actor_email: "fallback@x.com",
    });
  });

  it("writes a null actor when there is no session", async () => {
    const { adminTables } = setup({ user: null });

    await writeAudit({ action: "delete", entityType: "rooms", entityId: "r1" });

    expect(adminTables.audit_logs[0]).toMatchObject({
      actor_id: null,
      actor_email: null,
    });
  });

  it("defaults old/new values to null when omitted", async () => {
    const { adminTables } = setup({ user: null });

    await writeAudit({ action: "delete", entityType: "rooms", entityId: "r1" });

    expect(adminTables.audit_logs[0]).toMatchObject({
      old_values: null,
      new_values: null,
    });
  });
});
