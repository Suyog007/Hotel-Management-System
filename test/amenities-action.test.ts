import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({ server: null as unknown, writeAudit: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));

import { createAmenity, updateAmenity, deleteAmenity } from "@/app/(admin)/admin/amenities/actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  const defaults = { name: "Free Wi-Fi", icon: "wifi", description: "", sort_order: "0" };
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v);
  return fd;
}

function seed(rows: Record<string, unknown>[] = []) {
  h.server = createFakeSupabase({ amenities: rows });
  return h.server as ReturnType<typeof createFakeSupabase>;
}

beforeEach(() => {
  h.writeAudit.mockReset();
});

describe("createAmenity", () => {
  it("inserts a row, writes an audit log, and redirects saved=1", async () => {
    const server = seed();
    const url = await expectRedirectTo(() => createAmenity(form({})));
    expect(url).toBe("/admin/amenities?saved=1");
    expect(server.__tables.amenities).toHaveLength(1);
    expect(server.__tables.amenities[0]).toMatchObject({ name: "Free Wi-Fi", icon: "wifi" });
    expect(h.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "create", entityType: "amenities" }));
  });

  it("rejects invalid input (empty name) without inserting", async () => {
    const server = seed();
    const url = await expectRedirectTo(() => createAmenity(form({ name: "" })));
    expect(url).toMatch(/^\/admin\/amenities\?error=/);
    expect(server.__tables.amenities).toHaveLength(0);
  });
});

describe("updateAmenity", () => {
  it("updates the row and logs old + new values", async () => {
    const server = seed([{ id: "11111111-1111-1111-1111-111111111111", name: "Old Name", icon: "wifi", sort_order: 0, is_visible: true }]);
    const url = await expectRedirectTo(() => updateAmenity(form({ id: "11111111-1111-1111-1111-111111111111", name: "New Name" })));
    expect(url).toBe("/admin/amenities?saved=1");
    expect(server.__tables.amenities[0]).toMatchObject({ name: "New Name" });
    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        oldValues: expect.objectContaining({ name: "Old Name" }),
        newValues: expect.objectContaining({ name: "New Name" }),
      }),
    );
  });

  it("rejects a missing id", async () => {
    const server = seed([{ id: "11111111-1111-1111-1111-111111111111", name: "Old Name" }]);
    const url = await expectRedirectTo(() => updateAmenity(form({ id: "" })));
    expect(url).toMatch(/Invalid%20input/);
    expect(server.__tables.amenities[0]).toMatchObject({ name: "Old Name" });
  });
});

describe("deleteAmenity", () => {
  it("removes the row and logs the deleted values", async () => {
    const server = seed([{ id: "11111111-1111-1111-1111-111111111111", name: "Gone Soon" }]);
    const fd = new FormData();
    fd.set("id", "11111111-1111-1111-1111-111111111111");
    const url = await expectRedirectTo(() => deleteAmenity(fd));
    expect(url).toBe("/admin/amenities?saved=1");
    expect(server.__tables.amenities).toHaveLength(0);
    expect(h.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", oldValues: expect.objectContaining({ name: "Gone Soon" }) }),
    );
  });

  it("bails when id is missing", async () => {
    const server = seed([{ id: "11111111-1111-1111-1111-111111111111", name: "Still Here" }]);
    const fd = new FormData();
    const url = await expectRedirectTo(() => deleteAmenity(fd));
    expect(url).toMatch(/Missing%20id/);
    expect(server.__tables.amenities).toHaveLength(1);
  });
});
