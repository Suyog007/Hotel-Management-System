"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { brandingSchema } from "@/lib/validation/cms";

export async function updateBranding(formData: FormData) {
  const parsed = brandingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    redirect(`/admin/branding?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("branding")
    .select("*")
    .eq("id", true)
    .single();

  const { error } = await supabase
    .from("branding")
    .update(parsed.data)
    .eq("id", true);
  if (error) {
    redirect(`/admin/branding?error=${encodeURIComponent(error.message)}`);
  }

  await writeAudit({
    action: "update",
    entityType: "branding",
    entityId: "singleton",
    oldValues: oldRow,
    newValues: parsed.data,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/branding");
  redirect("/admin/branding?saved=1");
}
