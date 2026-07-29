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

/**
 * FormData gives back `File | string`; a file input that was left empty still
 * submits an entry (a zero-byte File), so "was a file actually chosen?" has to
 * be a size check, not a presence check.
 */
function chosenFiles(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((v): v is File => typeof v !== "string" && v !== null && v.size > 0);
}

/**
 * Upload the file picked in a single-file field, if any.
 *
 * Returns the public URL, or null when the admin left the picker empty — which
 * is the signal for callers to keep whatever URL was already on the record.
 * Throws on a rejected file (too big / wrong type) so the caller can redirect
 * with the message.
 */
export async function uploadFormImage(
  formData: FormData,
  field: string,
  folder: string,
): Promise<string | null> {
  const [file] = chosenFiles(formData, field);
  if (!file) return null;
  const { url } = await uploadPublicImage(file, folder);
  return url;
}

/** Same, for a `multiple` file input. Returns URLs in the order picked. */
export async function uploadFormImages(
  formData: FormData,
  field: string,
  folder: string,
): Promise<string[]> {
  const urls: string[] = [];
  // Sequential on purpose: a parallel burst of 10 MB uploads is a good way to
  // get rate-limited by Storage, and admins add photos a few at a time.
  for (const file of chosenFiles(formData, field)) {
    urls.push((await uploadPublicImage(file, folder)).url);
  }
  return urls;
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
