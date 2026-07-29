import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  uploads: [] as { path: string; contentType: string }[],
  uploadError: null as { message: string } | null,
  removed: [] as string[],
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: async (path: string, _file: File, opts: { contentType: string }) => {
          h.uploads.push({ path, contentType: opts.contentType });
          return { error: h.uploadError };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://proj.supabase.co/storage/v1/object/public/public-images/${path}`,
          },
        }),
        remove: async (paths: string[]) => {
          h.removed.push(...paths);
          return { error: null };
        },
      }),
    },
  }),
}));

import { uploadFormImage, uploadFormImages } from "@/lib/storage";

function png(name = "photo.png", bytes = 128) {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

beforeEach(() => {
  h.uploads = [];
  h.removed = [];
  h.uploadError = null;
});

describe("uploadFormImage", () => {
  it("returns null when the field is absent, so the existing URL survives", async () => {
    const fd = new FormData();
    fd.set("image_url", "https://example.test/keep-me.jpg");
    expect(await uploadFormImage(fd, "image_file", "menu")).toBeNull();
    expect(h.uploads).toHaveLength(0);
  });

  it("returns null for an untouched file input (browsers submit a 0-byte File)", async () => {
    const fd = new FormData();
    fd.set("image_file", new File([], "", { type: "application/octet-stream" }));
    expect(await uploadFormImage(fd, "image_file", "menu")).toBeNull();
    expect(h.uploads).toHaveLength(0);
  });

  it("uploads a chosen file into the requested folder and returns its public URL", async () => {
    const fd = new FormData();
    fd.set("image_file", png());
    const url = await uploadFormImage(fd, "image_file", "menu");
    expect(h.uploads).toHaveLength(1);
    expect(h.uploads[0].path).toMatch(/^menu\/[0-9a-f-]{36}\.png$/);
    expect(h.uploads[0].contentType).toBe("image/png");
    expect(url).toBe(
      `https://proj.supabase.co/storage/v1/object/public/public-images/${h.uploads[0].path}`,
    );
  });

  it("rejects a non-image file", async () => {
    const fd = new FormData();
    fd.set("image_file", new File([new Uint8Array(8)], "notes.pdf", { type: "application/pdf" }));
    await expect(uploadFormImage(fd, "image_file", "menu")).rejects.toThrow(/Unsupported image type/);
    expect(h.uploads).toHaveLength(0);
  });

  it("rejects a file over the 10 MB cap", async () => {
    const fd = new FormData();
    fd.set("image_file", png("huge.png", 10 * 1024 * 1024 + 1));
    await expect(uploadFormImage(fd, "image_file", "menu")).rejects.toThrow(/too large/i);
    expect(h.uploads).toHaveLength(0);
  });

  it("surfaces a storage failure instead of returning a broken URL", async () => {
    h.uploadError = { message: "bucket missing" };
    const fd = new FormData();
    fd.set("image_file", png());
    await expect(uploadFormImage(fd, "image_file", "menu")).rejects.toThrow(/bucket missing/);
  });
});

describe("uploadFormImages", () => {
  it("returns an empty list when nothing was picked", async () => {
    expect(await uploadFormImages(new FormData(), "image_files", "rooms")).toEqual([]);
  });

  it("uploads every picked file, in order, skipping empty entries", async () => {
    const fd = new FormData();
    fd.append("image_files", png("a.png"));
    fd.append("image_files", new File([], "", { type: "application/octet-stream" }));
    fd.append("image_files", png("b.png"));

    const urls = await uploadFormImages(fd, "image_files", "rooms");
    expect(urls).toHaveLength(2);
    expect(h.uploads.map((u) => u.path)).toEqual([
      expect.stringMatching(/^rooms\//),
      expect.stringMatching(/^rooms\//),
    ]);
    expect(urls[0]).toContain(h.uploads[0].path);
    expect(urls[1]).toContain(h.uploads[1].path);
  });
});
