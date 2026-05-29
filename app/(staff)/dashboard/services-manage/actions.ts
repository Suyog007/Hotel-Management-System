"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { serviceSchema } from "@/lib/validation/services";

function parse(formData: FormData) {
  return serviceSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    price: formData.get("price"),
    image_url: formData.get("image_url"),
    is_active: formData.get("is_active") === "on",
    sort_order: formData.get("sort_order"),
  });
}

function bail(msg: string): never {
  redirect(`/dashboard/services-manage?error=${encodeURIComponent(msg)}`);
}

export async function createService(formData: FormData) {
  const parsed = parse(formData);
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));
  const { id: _i, ...insert } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("services").insert(insert).select().single();
  if (error) bail(error.message);

  await writeAudit({
    action: "create",
    entityType: "services",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/dashboard/services-manage");
  revalidatePath("/services");
  redirect("/dashboard/services-manage?saved=1");
}

export async function updateService(formData: FormData) {
  const parsed = parse(formData);
  if (!parsed.success || !parsed.data.id)
    bail(parsed.success ? "Missing id" : parsed.error.issues.map((i) => i.message).join("; "));
  const { id, ...update } = parsed.data;

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase.from("services").select("*").eq("id", id).single();
  const { error } = await supabase.from("services").update(update).eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "services",
    entityId: id!,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/dashboard/services-manage");
  revalidatePath("/services");
  redirect("/dashboard/services-manage?saved=1");
}

export async function deleteService(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) bail("Missing id");
  const supabase = await createServerClient();
  const { data: oldRow } = await supabase.from("services").select("*").eq("id", id).single();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) bail(error.message);

  await writeAudit({
    action: "delete",
    entityType: "services",
    entityId: id,
    oldValues: oldRow,
  });

  revalidatePath("/dashboard/services-manage");
  revalidatePath("/services");
  redirect("/dashboard/services-manage?saved=1");
}
