"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { amenitySchema } from "@/lib/validation/cms";

function parseFromForm(formData: FormData) {
  return amenitySchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    icon: formData.get("icon"),
    description: formData.get("description"),
    sort_order: formData.get("sort_order"),
    is_visible: formData.get("is_visible") === "on",
  });
}

export async function createAmenity(formData: FormData) {
  const parsed = parseFromForm(formData);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(`/admin/amenities?error=${encodeURIComponent(message)}`);
  }
  const { id: _ignore, ...insert } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("amenities")
    .insert(insert)
    .select()
    .single();
  if (error) redirect(`/admin/amenities?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "create",
    entityType: "amenities",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/admin/amenities");
  redirect("/admin/amenities?saved=1");
}

export async function updateAmenity(formData: FormData) {
  const parsed = parseFromForm(formData);
  if (!parsed.success || !parsed.data.id) {
    redirect(`/admin/amenities?error=${encodeURIComponent("Invalid input")}`);
  }
  const { id, ...update } = parsed.data;

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("amenities")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("amenities")
    .update(update)
    .eq("id", id);
  if (error) redirect(`/admin/amenities?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "amenities",
    entityId: id,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/admin/amenities");
  redirect("/admin/amenities?saved=1");
}

export async function deleteAmenity(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) redirect(`/admin/amenities?error=${encodeURIComponent("Missing id")}`);

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("amenities")
    .select("*")
    .eq("id", id!)
    .single();

  const { error } = await supabase.from("amenities").delete().eq("id", id!);
  if (error) redirect(`/admin/amenities?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "delete",
    entityType: "amenities",
    entityId: id!,
    oldValues: oldRow,
  });

  revalidatePath("/admin/amenities");
  redirect("/admin/amenities?saved=1");
}
