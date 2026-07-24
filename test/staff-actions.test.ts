import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({
  server: null as unknown,
  admin: null as unknown,
  writeAudit: vi.fn(),
  inviteResult: { error: null as { message: string } | null },
}));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));

import { inviteStaff, changeRole, toggleActive } from "@/app/(admin)/admin/staff/actions";

const SUPER_ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function seed(opts: {
  actorRole?: string;
  user?: { id: string } | null;
  profiles?: Record<string, unknown>[];
}) {
  h.server = createFakeSupabase(
    { profiles: [{ id: SUPER_ADMIN_ID, auth_user_id: "auth-1", role: opts.actorRole ?? "super_admin" }] },
    { user: opts.user === null ? null : { id: "auth-1" } },
  );
  h.admin = createFakeSupabase(
    { profiles: opts.profiles ?? [] },
    { onInviteUser: () => h.inviteResult },
  );
  return h.admin as ReturnType<typeof createFakeSupabase>;
}

beforeEach(() => {
  h.writeAudit.mockReset();
  h.inviteResult = { error: null };
});

describe("requireSuperAdmin gate (shared by all three actions)", () => {
  it("inviteStaff redirects to /login when unauthenticated", async () => {
    seed({ user: null });
    const url = await expectRedirectTo(() => inviteStaff(form({ email: "a@x.com", full_name: "A", role: "manager" })));
    expect(url).toBe("/login?next=/admin/staff");
  });

  it("changeRole rejects a non-super_admin actor", async () => {
    seed({ actorRole: "manager" });
    const url = await expectRedirectTo(() => changeRole(form({ profile_id: TARGET_ID, role: "manager" })));
    expect(url).toMatch(/^\/admin\?error=Super/);
  });
});

describe("inviteStaff", () => {
  it("creates a new stub profile, sends the invite, writes an audit log, and redirects saved=1", async () => {
    const admin = seed({});
    const url = await expectRedirectTo(() =>
      inviteStaff(form({ email: "new@x.com", full_name: "New Person", role: "receptionist" })),
    );
    expect(url).toBe("/admin/staff?saved=1");
    expect(admin.__tables.profiles).toHaveLength(1);
    expect(admin.__tables.profiles[0]).toMatchObject({
      email: "new@x.com",
      role: "receptionist",
      is_stub: true,
      is_active: true,
    });
    expect(h.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "create", entityType: "profiles" }));
  });

  it("updates an existing stub profile by email instead of inserting a duplicate", async () => {
    const admin = seed({ profiles: [{ id: "stub-1", email: "existing@x.com", role: "guest", is_active: false }] });
    await expectRedirectTo(() =>
      inviteStaff(form({ email: "existing@x.com", full_name: "Existing Person", role: "manager" })),
    );
    expect(admin.__tables.profiles).toHaveLength(1);
    expect(admin.__tables.profiles[0]).toMatchObject({ role: "manager", is_active: true, full_name: "Existing Person" });
  });

  it("keeps the profile but surfaces an error when the invite email fails to send", async () => {
    seed({});
    h.inviteResult = { error: { message: "SMTP down" } };
    const url = await expectRedirectTo(() =>
      inviteStaff(form({ email: "new@x.com", full_name: "New Person", role: "receptionist" })),
    );
    expect(url).toMatch(/invite%20email%20failed/);
  });

  it("bails on invalid input without touching the DB", async () => {
    const admin = seed({});
    const url = await expectRedirectTo(() => inviteStaff(form({ email: "not-an-email", full_name: "X", role: "manager" })));
    expect(url).toMatch(/^\/admin\/staff\?error=/);
    expect(admin.__tables.profiles).toHaveLength(0);
  });
});

describe("changeRole", () => {
  it("refuses to let a super_admin demote themselves", async () => {
    const admin = seed({ profiles: [{ id: SUPER_ADMIN_ID, role: "super_admin" }] });
    const url = await expectRedirectTo(() => changeRole(form({ profile_id: SUPER_ADMIN_ID, role: "manager" })));
    expect(url).toMatch(/Cannot%20demote%20yourself/);
    expect(admin.__tables.profiles[0]).toMatchObject({ role: "super_admin" });
  });

  it("allows a super_admin to re-affirm their own role as super_admin", async () => {
    const admin = seed({ profiles: [{ id: SUPER_ADMIN_ID, role: "super_admin", email: "me@x.com" }] });
    const url = await expectRedirectTo(() => changeRole(form({ profile_id: SUPER_ADMIN_ID, role: "super_admin" })));
    expect(url).toBe("/admin/staff?saved=1");
    void admin;
  });

  it("changes another profile's role and writes an audit log with old/new values", async () => {
    const admin = seed({ profiles: [{ id: TARGET_ID, role: "receptionist", email: "target@x.com" }] });
    const url = await expectRedirectTo(() => changeRole(form({ profile_id: TARGET_ID, role: "manager" })));
    expect(url).toBe("/admin/staff?saved=1");
    expect(admin.__tables.profiles.find((p) => p.id === TARGET_ID)).toMatchObject({ role: "manager" });
    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityType: "profiles",
        oldValues: expect.objectContaining({ role: "receptionist" }),
        newValues: { role: "manager" },
      }),
    );
  });
});

describe("toggleActive", () => {
  it("refuses to let a super_admin disable themselves", async () => {
    const admin = seed({ profiles: [{ id: SUPER_ADMIN_ID, is_active: true }] });
    const url = await expectRedirectTo(() => toggleActive(form({ profile_id: SUPER_ADMIN_ID, is_active: "false" })));
    expect(url).toMatch(/Cannot%20disable%20yourself/);
    expect(admin.__tables.profiles[0]).toMatchObject({ is_active: true });
  });

  it("allows a super_admin to re-enable themselves", async () => {
    seed({ profiles: [{ id: SUPER_ADMIN_ID, is_active: false }] });
    const url = await expectRedirectTo(() => toggleActive(form({ profile_id: SUPER_ADMIN_ID, is_active: "true" })));
    expect(url).toBe("/admin/staff?saved=1");
  });

  it("disables another staff member and writes an audit log", async () => {
    const admin = seed({ profiles: [{ id: TARGET_ID, is_active: true, email: "target@x.com" }] });
    const url = await expectRedirectTo(() => toggleActive(form({ profile_id: TARGET_ID, is_active: "false" })));
    expect(url).toBe("/admin/staff?saved=1");
    expect(admin.__tables.profiles.find((p) => p.id === TARGET_ID)).toMatchObject({ is_active: false });
    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", newValues: { is_active: false } }),
    );
  });
});
