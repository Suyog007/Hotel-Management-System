"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { galleryImageSchema } from "@/lib/validation/cms";
import { deletePublicImageByUrl, uploadPublicImage } from "@/lib/storage";

export async function uploadGalleryImage(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    redirect(`/admin/gallery?error=No+file+selected`);
  }

  let uploaded: { url: string; path: string };
  try {
    uploaded = await uploadPublicImage(file, "gallery");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    redirect(`/admin/gallery?error=${encodeURIComponent(msg)}`);
  }

  const parsed = galleryImageSchema.safeParse({
    image_url: uploaded.url,
    caption: formData.get("caption"),
    category: formData.get("category"),
    sort_order: formData.get("sort_order"),
    is_visible: formData.get("is_visible") === "on",
  });
  if (!parsed.success) {
    redirect(
      `/admin/gallery?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
    );
  }
  const { id: _ignore, ...insert } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("gallery_images")
    .insert(insert)
    .select()
    .single();
  if (error) {
    // Roll back the storage object so we don't leak orphans
    await deletePublicImageByUrl(uploaded.url);
    redirect(`/admin/gallery?error=${encodeURIComponent(error.message)}`);
  }

  await writeAudit({
    action: "create",
    entityType: "gallery_images",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath("/admin/gallery");
  redirect("/admin/gallery?saved=1");
}

export async function updateGalleryImage(formData: FormData) {
  const parsed = galleryImageSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    image_url: formData.get("image_url"),
    caption: formData.get("caption"),
    category: formData.get("category"),
    sort_order: formData.get("sort_order"),
    is_visible: formData.get("is_visible") === "on",
  });
  if (!parsed.success || !parsed.data.id) {
    redirect(`/admin/gallery?error=Invalid+input`);
  }
  const { id, ...update } = parsed.data;

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("gallery_images")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("gallery_images")
    .update(update)
    .eq("id", id);
  if (error) redirect(`/admin/gallery?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "gallery_images",
    entityId: id,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath("/admin/gallery");
  redirect("/admin/gallery?saved=1");
}

export async function deleteGalleryImage(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) redirect(`/admin/gallery?error=Missing+id`);

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("gallery_images")
    .select("*")
    .eq("id", id!)
    .single();
  if (!oldRow) redirect(`/admin/gallery?error=Not+found`);

  const { error } = await supabase.from("gallery_images").delete().eq("id", id!);
  if (error) redirect(`/admin/gallery?error=${encodeURIComponent(error.message)}`);

  // Best-effort: remove the storage object too
  await deletePublicImageByUrl((oldRow as { image_url: string }).image_url);

  await writeAudit({
    action: "delete",
    entityType: "gallery_images",
    entityId: id!,
    oldValues: oldRow,
  });

  revalidatePath("/admin/gallery");
  redirect("/admin/gallery?saved=1");
}
