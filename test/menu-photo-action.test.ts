import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({
  server: null as unknown,
  writeAudit: vi.fn(),
  uploadedPaths: [] as string[],
}));

vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/audit", () => ({ writeAudit: h.writeAudit }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: async (path: string) => {
          h.uploadedPaths.push(path);
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://proj.supabase.co/storage/v1/object/public/public-images/${path}`,
          },
        }),
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));

import { updateFoodItem } from "@/app/(staff)/dashboard/menu/actions";

const EXISTING = "https://example.test/existing-photo.jpg";
const ID = "11111111-1111-1111-1111-111111111111";

function seed() {
  h.server = createFakeSupabase({
    food_items: [
      {
        id: ID,
        name: "Chicken Momo",
        description: "Steamed",
        price: 250,
        category: "Snacks",
        image_url: EXISTING,
        is_available: true,
        sort_order: 0,
      },
    ],
  });
  return h.server as ReturnType<typeof createFakeSupabase>;
}

function form(extra: (fd: FormData) => void = () => {}) {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("name", "Chicken Momo");
  fd.set("description", "Steamed");
  fd.set("price", "250");
  fd.set("category", "Snacks");
  fd.set("image_url", EXISTING);
  fd.set("sort_order", "0");
  fd.set("is_available", "on");
  extra(fd);
  return fd;
}

beforeEach(() => {
  h.writeAudit.mockReset();
  h.uploadedPaths = [];
});

describe("updateFoodItem photo handling", () => {
  it("keeps the existing photo when the file picker was left empty", async () => {
    const server = seed();
    // Browsers submit an empty File for an untouched <input type="file">.
    const fd = form((f) => f.set("image_file", new File([], "")));

    const url = await expectRedirectTo(() => updateFoodItem(fd));

    expect(url).toBe("/dashboard/menu?saved=1");
    expect(h.uploadedPaths).toHaveLength(0);
    expect(server.__tables.food_items[0].image_url).toBe(EXISTING);
  });

  it("replaces the photo with the uploaded file when one is picked", async () => {
    const server = seed();
    const fd = form((f) =>
      f.set("image_file", new File([new Uint8Array(64)], "momo.png", { type: "image/png" })),
    );

    await expectRedirectTo(() => updateFoodItem(fd));

    expect(h.uploadedPaths).toHaveLength(1);
    expect(h.uploadedPaths[0]).toMatch(/^menu\//);
    expect(server.__tables.food_items[0].image_url).toBe(
      `https://proj.supabase.co/storage/v1/object/public/public-images/${h.uploadedPaths[0]}`,
    );
  });

  it("clears the photo when the field is emptied (null, not a dropped key)", async () => {
    const server = seed();
    const fd = form((f) => {
      f.set("image_url", "");
      f.set("image_file", new File([], ""));
    });

    await expectRedirectTo(() => updateFoodItem(fd));

    expect(server.__tables.food_items[0].image_url).toBeNull();
  });

  it("reports a rejected file instead of saving the row", async () => {
    const server = seed();
    const fd = form((f) =>
      f.set("image_file", new File([new Uint8Array(8)], "menu.pdf", { type: "application/pdf" })),
    );

    const url = await expectRedirectTo(() => updateFoodItem(fd));

    expect(url).toMatch(/error=/);
    expect(decodeURIComponent(url)).toMatch(/Unsupported image type/);
    expect(server.__tables.food_items[0].image_url).toBe(EXISTING);
  });
});
