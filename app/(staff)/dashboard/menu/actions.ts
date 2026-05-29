"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { foodItemSchema } from "@/lib/validation/menu";

function parse(formData: FormData) {
  return foodItemSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    category: formData.get("category"),
    image_url: formData.get("image_url"),
    is_available: formData.get("is_available") === "on",
    sort_order: formData.get("sort_order"),
  });
}

function bail(msg: string): never {
  redirect(`/dashboard/menu?error=${encodeURIComponent(msg)}`);
}

export async function createFoodItem(formData: FormData) {
  const parsed = parse(formData);
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
  const parsed = parse(formData);
  if (!parsed.success || !parsed.data.id)
    bail(parsed.success ? "Missing id" : parsed.error.issues.map((i) => i.message).join("; "));
  const { id, ...update } = parsed.data;

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
