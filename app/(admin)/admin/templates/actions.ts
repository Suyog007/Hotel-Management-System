"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import {
  emailTemplateSchema,
  notificationTemplateSchema,
} from "@/lib/validation/templates";

export async function updateEmailTemplate(formData: FormData) {
  const key = formData.get("key") as string;
  if (!key) redirect(`/admin/templates?error=Missing+key`);

  const parsed = emailTemplateSchema.safeParse({
    subject: formData.get("subject"),
    body_html: formData.get("body_html"),
    body_text: formData.get("body_text"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    redirect(
      `/admin/templates?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
    );
  }

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("email_templates")
    .select("*")
    .eq("key", key)
    .single();

  const { error } = await supabase
    .from("email_templates")
    .update(parsed.data)
    .eq("key", key);
  if (error) redirect(`/admin/templates?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "email_templates",
    entityId: key,
    oldValues: oldRow,
    newValues: parsed.data,
  });

  revalidatePath("/admin/templates");
  redirect("/admin/templates?saved=1");
}

export async function updateNotificationTemplate(formData: FormData) {
  const key = formData.get("key") as string;
  if (!key) redirect(`/admin/templates?error=Missing+key`);

  const parsed = notificationTemplateSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    redirect(
      `/admin/templates?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
    );
  }

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("key", key)
    .single();

  const { error } = await supabase
    .from("notification_templates")
    .update(parsed.data)
    .eq("key", key);
  if (error) redirect(`/admin/templates?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "notification_templates",
    entityId: key,
    oldValues: oldRow,
    newValues: parsed.data,
  });

  revalidatePath("/admin/templates");
  redirect("/admin/templates?saved=1");
}
