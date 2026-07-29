import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";
import { roomSchema } from "@/lib/validation/rooms";
import { foodItemSchema } from "@/lib/validation/menu";
import { testimonialSchema } from "@/lib/validation/cms";

const h = vi.hoisted(() => ({ server: null as unknown, writeAudit: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { createRoom } from "@/app/(staff)/dashboard/rooms/actions";

const TYPE_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  h.writeAudit.mockReset();
  h.server = createFakeSupabase({ rooms: [] });
});

/**
 * Regression: the "Add a room" form nested under a room type has no Notes
 * field, so FormData.get("notes") is null. zod's .optional() accepts undefined
 * but not null, which failed every room creation with the unhelpful
 * "Expected string, received null".
 */
describe("createRoom with fields the form does not render", () => {
  it("creates the room when notes is absent from the form", async () => {
    const fd = new FormData();
    fd.set("room_number", "602");
    fd.set("type_id", TYPE_ID);
    fd.set("floor", "7");
    fd.set("status", "available");
    // no "notes" entry at all — this is the shape the nested form submits

    const url = await expectRedirectTo(() => createRoom(fd));

    expect(url).toBe("/dashboard/rooms?saved=1");
    const server = h.server as ReturnType<typeof createFakeSupabase>;
    expect(server.__tables.rooms).toHaveLength(1);
    expect(server.__tables.rooms[0]).toMatchObject({
      room_number: "602",
      type_id: TYPE_ID,
      floor: 7,
      status: "available",
    });
  });

  it("still accepts notes when the form does render them", async () => {
    const fd = new FormData();
    fd.set("room_number", "604");
    fd.set("type_id", TYPE_ID);
    fd.set("status", "available");
    fd.set("notes", "Corner room, garden view");

    await expectRedirectTo(() => createRoom(fd));

    const server = h.server as ReturnType<typeof createFakeSupabase>;
    expect(server.__tables.rooms[0].notes).toBe("Corner room, garden view");
  });
});

/** The same null-vs-undefined trap applies to every optionalText field. */
describe("optionalText treats an absent field like a blank one", () => {
  const absent = null as unknown as string;

  it("rooms: notes", () => {
    const r = roomSchema.safeParse({
      room_number: "1",
      type_id: TYPE_ID,
      status: "available",
      notes: absent,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBeUndefined();
  });

  it("menu: description and image_url", () => {
    const r = foodItemSchema.safeParse({
      name: "Momo",
      price: "250",
      category: "Snacks",
      description: absent,
      image_url: absent,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.image_url).toBeUndefined();
  });

  it("cms: testimonial avatar", () => {
    const r = testimonialSchema.safeParse({
      author_name: "A. Guest",
      body: "Lovely stay",
      image_url: absent,
      author_role: absent,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.image_url).toBeUndefined();
  });
});
