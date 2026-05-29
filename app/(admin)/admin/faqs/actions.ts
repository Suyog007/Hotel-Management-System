"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { faqSchema } from "@/lib/validation/cms";

function parseFromForm(formData: FormData) {
  return faqSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    question: formData.get("question"),
    answer: formData.get("answer"),
    category: formData.get("category"),
    sort_order: formData.get("sort_order"),
    is_visible: formData.get("is_visible") === "on",
  });
}

export async function createFaq(formData: FormData) {
  const parsed = parseFromForm(formData);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(`/admin/faqs?error=${encodeURIComponent(message)}`);
  }
  const { id: _ignore, ...insert } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("faqs")
    .insert(insert)
    .select()
    .single();
  if (error) redirect(`/admin/faqs?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "create",
    entityType: "faqs",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/admin/faqs");
  redirect("/admin/faqs?saved=1");
}

export async function updateFaq(formData: FormData) {
  const parsed = parseFromForm(formData);
  if (!parsed.success || !parsed.data.id) {
    redirect(`/admin/faqs?error=${encodeURIComponent("Invalid input")}`);
  }
  const { id, ...update } = parsed.data;

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("faqs")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("faqs").update(update).eq("id", id);
  if (error) redirect(`/admin/faqs?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "faqs",
    entityId: id,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/admin/faqs");
  redirect("/admin/faqs?saved=1");
}

export async function deleteFaq(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) redirect(`/admin/faqs?error=${encodeURIComponent("Missing id")}`);

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("faqs")
    .select("*")
    .eq("id", id!)
    .single();

  const { error } = await supabase.from("faqs").delete().eq("id", id!);
  if (error) redirect(`/admin/faqs?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "delete",
    entityType: "faqs",
    entityId: id!,
    oldValues: oldRow,
  });

  revalidatePath("/admin/faqs");
  redirect("/admin/faqs?saved=1");
}
