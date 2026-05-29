"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { siteSettingsSchema } from "@/lib/validation/cms";

export async function updateSettings(formData: FormData) {
  const parsed = siteSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    redirect(`/admin/settings?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .single();

  const { error } = await supabase
    .from("site_settings")
    .update(parsed.data)
    .eq("id", true);

  if (error) {
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  await writeAudit({
    action: "update",
    entityType: "site_settings",
    entityId: "singleton",
    oldValues: oldRow,
    newValues: parsed.data,
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
