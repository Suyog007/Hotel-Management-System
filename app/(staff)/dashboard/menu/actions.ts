"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { foodItemSchema } from "@/lib/validation/menu";
import { uploadFormImage } from "@/lib/storage";

function parse(formData: FormData, imageUrl: string | null) {
  return foodItemSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    category: formData.get("category"),
    // A freshly uploaded photo wins; otherwise keep whatever URL the form carried.
    image_url: imageUrl ?? formData.get("image_url"),
    is_available: formData.get("is_available") === "on",
    sort_order: formData.get("sort_order"),
  });
}

function bail(msg: string): never {
  redirect(`/dashboard/menu?error=${encodeURIComponent(msg)}`);
}

/** Uploads the picked photo, turning a rejected file into a friendly redirect. */
async function uploadPhoto(formData: FormData): Promise<string | null> {
  try {
    return await uploadFormImage(formData, "image_file", "menu");
  } catch (err) {
    bail(err instanceof Error ? err.message : "Photo upload failed");
  }
}

export async function createFoodItem(formData: FormData) {
  const parsed = parse(formData, await uploadPhoto(formData));
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));
  const { id: _i, ...insert } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("food_items").insert(insert).select().single();
  if (error) bail(error.message);

  await writeAudit({
    action: "create",
    entityType: "food_items",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/dashboard/menu");
  revalidatePath("/menu");
  redirect("/dashboard/menu?saved=1");
}

export async function updateFoodItem(formData: FormData) {
  const parsed = parse(formData, await uploadPhoto(formData));
  if (!parsed.success || !parsed.data.id)
    bail(parsed.success ? "Missing id" : parsed.error.issues.map((i) => i.message).join("; "));
  const { id, ...rest } = parsed.data;
  // Clearing the photo yields undefined, which PostgREST drops from the patch —
  // the removal would silently not stick. Write an explicit null.
  const update = { ...rest, image_url: rest.image_url ?? null };

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase.from("food_items").select("*").eq("id", id).single();
  const { error } = await supabase.from("food_items").update(update).eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "food_items",
    entityId: id!,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/dashboard/menu");
  revalidatePath("/menu");
  redirect("/dashboard/menu?saved=1");
}

export async function deleteFoodItem(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) bail("Missing id");
  const supabase = await createServerClient();
  const { data: oldRow } = await supabase.from("food_items").select("*").eq("id", id).single();
  const { error } = await supabase.from("food_items").delete().eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "delete",
    entityType: "food_items",
    entityId: id,
    oldValues: oldRow,
  });

  revalidatePath("/dashboard/menu");
  revalidatePath("/menu");
  redirect("/dashboard/menu?saved=1");
}
