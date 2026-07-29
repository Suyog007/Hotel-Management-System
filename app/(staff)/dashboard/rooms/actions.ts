"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { roomTypeSchema, roomSchema } from "@/lib/validation/rooms";
import { uploadFormImages } from "@/lib/storage";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function bail(msg: string): never {
  redirect(`/dashboard/rooms?error=${encodeURIComponent(msg)}`);
}

// ── Room types ────────────────────────────────────────────────────────────────

/**
 * Uploads any newly picked room photos and appends them to the URL list the
 * form already carried, so "add two more photos" doesn't wipe the existing set.
 */
async function withUploadedPhotos(formData: FormData): Promise<string> {
  let uploaded: string[];
  try {
    uploaded = await uploadFormImages(formData, "image_files", "rooms");
  } catch (err) {
    bail(err instanceof Error ? err.message : "Photo upload failed");
  }
  const existing = (formData.get("images") as string | null) ?? "";
  return [existing, ...uploaded].filter(Boolean).join("\n");
}

function parseRoomType(formData: FormData, images: string) {
  return roomTypeSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    base_price: formData.get("base_price"),
    original_price: formData.get("original_price"),
    max_guests: formData.get("max_guests"),
    amenities: formData.get("amenities"),
    images,
    is_active: formData.get("is_active") === "on",
    sort_order: formData.get("sort_order"),
  });
}

export async function createRoomType(formData: FormData) {
  const parsed = parseRoomType(formData, await withUploadedPhotos(formData));
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));
  const { id: _ignore, slug, name, original_price, ...rest } = parsed.data;
  // Blank field means "no offer" — write an explicit null, not undefined.
  const insert = { name, slug: slug || slugify(name), original_price: original_price ?? null, ...rest };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("room_types")
    .insert(insert)
    .select()
    .single();
  if (error) bail(error.message);

  await writeAudit({
    action: "create",
    entityType: "room_types",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/dashboard/rooms");
  revalidatePath("/rooms");
  redirect("/dashboard/rooms?saved=1");
}

export async function updateRoomType(formData: FormData) {
  const parsed = parseRoomType(formData, await withUploadedPhotos(formData));
  if (!parsed.success || !parsed.data.id)
    bail(parsed.success ? "Missing id" : parsed.error.issues.map((i) => i.message).join("; "));
  const { id, slug, name, original_price, ...rest } = parsed.data;
  // Clearing the field must clear the offer, so send null rather than omitting it.
  const update = { name, slug: slug || slugify(name), original_price: original_price ?? null, ...rest };

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("room_types")
    .select("*")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("room_types")
    .update(update)
    .eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "room_types",
    entityId: id!,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/dashboard/rooms");
  revalidatePath("/rooms");
  revalidatePath(`/rooms/${update.slug}`);
  redirect("/dashboard/rooms?saved=1");
}

export async function deleteRoomType(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) bail("Missing id");

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("room_types")
    .select("*")
    .eq("id", id!)
    .single();
  const { error } = await supabase.from("room_types").delete().eq("id", id!);
  if (error) bail(error.message);

  await writeAudit({
    action: "delete",
    entityType: "room_types",
    entityId: id!,
    oldValues: oldRow,
  });

  revalidatePath("/dashboard/rooms");
  revalidatePath("/rooms");
  redirect("/dashboard/rooms?saved=1");
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

function parseRoom(formData: FormData) {
  return roomSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    room_number: formData.get("room_number"),
    type_id: formData.get("type_id"),
    floor: formData.get("floor"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createRoom(formData: FormData) {
  const parsed = parseRoom(formData);
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));
  const { id: _ignore, ...insert } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("rooms")
    .insert(insert)
    .select()
    .single();
  if (error) bail(error.message);

  await writeAudit({
    action: "create",
    entityType: "rooms",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/dashboard/rooms");
  redirect("/dashboard/rooms?saved=1");
}

export async function updateRoom(formData: FormData) {
  const parsed = parseRoom(formData);
  if (!parsed.success || !parsed.data.id)
    bail(parsed.success ? "Missing id" : parsed.error.issues.map((i) => i.message).join("; "));
  const { id, ...update } = parsed.data;

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("rooms").update(update).eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "rooms",
    entityId: id!,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/dashboard/rooms");
  redirect("/dashboard/rooms?saved=1");
}

export async function deleteRoom(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) bail("Missing id");

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id!)
    .single();
  const { error } = await supabase.from("rooms").delete().eq("id", id!);
  if (error) bail(error.message);

  await writeAudit({
    action: "delete",
    entityType: "rooms",
    entityId: id!,
    oldValues: oldRow,
  });

  revalidatePath("/dashboard/rooms");
  redirect("/dashboard/rooms?saved=1");
}
