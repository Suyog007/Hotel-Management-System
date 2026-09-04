import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({
  server: null as unknown,
  admin: null as unknown,
  writeAudit: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));

import { setRoomStatus } from "@/app/(staff)/dashboard/bookings/actions";

const ROOM_ID = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  fd.set("room_id", ROOM_ID);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function seed(roomStatus = "cleaning") {
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [{ id: "s1", auth_user_id: "auth-1", role: "receptionist", is_active: true }],
    rooms: [{ id: ROOM_ID, status: roomStatus }],
  };
  h.server = createFakeSupabase(tables, { user: { id: "auth-1" } });
  h.admin = createFakeSupabase(tables, { user: { id: "auth-1" } });
  return tables;
}

beforeEach(() => h.writeAudit.mockReset());

describe("setRoomStatus", () => {
  it("marks a cleaning room available and returns to the redirect path", async () => {
    const tables = seed("cleaning");
    const url = await expectRedirectTo(() =>
      setRoomStatus(form({ status: "available", redirect_to: "/dashboard" })),
    );
    expect(url).toBe("/dashboard?saved=1");
    expect(tables.rooms[0]).toMatchObject({ status: "available" });
    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "rooms", newValues: { status: "available" } }),
    );
  });

  it("sends a free room to maintenance", async () => {
    const tables = seed("available");
    await expectRedirectTo(() => setRoomStatus(form({ status: "maintenance" })));
    expect(tables.rooms[0]).toMatchObject({ status: "maintenance" });
  });

  it("refuses an invalid target status", async () => {
    const tables = seed("cleaning");
    const url = await expectRedirectTo(() => setRoomStatus(form({ status: "occupied" })));
    expect(url).toMatch(/error=Invalid/);
    expect(tables.rooms[0]).toMatchObject({ status: "cleaning" });
  });

  it("won't change an occupied room from the map", async () => {
    const tables = seed("occupied");
    const url = await expectRedirectTo(() => setRoomStatus(form({ status: "cleaning" })));
    expect(url).toMatch(/error=That%20room%20is%20occupied/);
    expect(tables.rooms[0]).toMatchObject({ status: "occupied" });
  });

  it("ignores an off-site redirect_to", async () => {
    seed("cleaning");
    const url = await expectRedirectTo(() =>
      setRoomStatus(form({ status: "available", redirect_to: "https://evil.example" })),
    );
    expect(url).toBe("/dashboard/bookings?saved=1");
  });
});
