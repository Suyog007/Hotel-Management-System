import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "public-images";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches bucket setting

export async function uploadPublicImage(
  file: File,
  folder = "gallery",
): Promise<{ url: string; path: string }> {
  if (!file || file.size === 0) throw new Error("No file provided.");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 10 MB).");
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${folder}/${randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl, path };
}

export async function deletePublicImageByUrl(url: string): Promise<void> {
  const path = pathFromPublicUrl(url);
  if (!path) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([path]);
}

export function pathFromPublicUrl(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/public-images\/(.+)$/);
  return match?.[1] ?? null;
}
