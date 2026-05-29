"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { pageMetaSchema, SECTION_TYPES, defaultSectionContent, parseSectionContent, type SectionType } from "@/lib/validation/sections";

export async function updatePageMeta(formData: FormData) {
  const slug = formData.get("slug") as string;
  if (!slug) redirect(`/admin/pages?error=Missing+slug`);

  const parsed = pageMetaSchema.safeParse({
    title: formData.get("title"),
    meta_title: formData.get("meta_title"),
    meta_description: formData.get("meta_description"),
    is_published: formData.get("is_published") === "on",
  });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(`/admin/pages/${slug}?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!oldRow) redirect(`/admin/pages?error=Page+not+found`);

  const { error } = await supabase
    .from("pages")
    .update(parsed.data)
    .eq("slug", slug);
  if (error) redirect(`/admin/pages/${slug}?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "pages",
    entityId: (oldRow as { id: string }).id,
    oldValues: oldRow,
    newValues: parsed.data,
  });

  revalidatePath(`/admin/pages/${slug}`);
  if (slug === "home") revalidatePath("/");
  redirect(`/admin/pages/${slug}?saved=1`);
}

export async function createSection(formData: FormData) {
  const slug = formData.get("slug") as string;
  const type = formData.get("section_type") as string;
  if (!slug || !SECTION_TYPES.includes(type as SectionType)) {
    redirect(`/admin/pages/${slug ?? ""}?error=Invalid+section+type`);
  }

  const supabase = await createServerClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!page) redirect(`/admin/pages?error=Page+not+found`);

  const { data: existing } = await supabase
    .from("page_sections")
    .select("sort_order")
    .eq("page_id", (page as { id: string }).id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder =
    ((existing as { sort_order: number }[] | null)?.[0]?.sort_order ?? -1) + 1;

  const insert = {
    page_id: (page as { id: string }).id,
    section_type: type,
    sort_order: nextOrder,
    is_visible: true,
    content: defaultSectionContent(type as SectionType),
  };
  const { data, error } = await supabase
    .from("page_sections")
    .insert(insert)
    .select()
    .single();
  if (error) redirect(`/admin/pages/${slug}?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "create",
    entityType: "page_sections",
    entityId: (data as { id: string }).id,
    newValues: insert,
  });

  revalidatePath(`/admin/pages/${slug}`);
  if (slug === "home") revalidatePath("/");
  redirect(`/admin/pages/${slug}?saved=1`);
}

export async function updateSection(formData: FormData) {
  const slug = formData.get("slug") as string;
  const id = formData.get("id") as string;
  const type = formData.get("section_type") as SectionType;
  if (!slug || !id || !SECTION_TYPES.includes(type)) {
    redirect(`/admin/pages/${slug ?? ""}?error=Invalid+section`);
  }

  // Build content object from per-type fields
  let rawContent: Record<string, unknown>;
  switch (type) {
    case "hero":
    case "cta":
      rawContent = {
        heading: formData.get("heading"),
        subheading: formData.get("subheading") ?? undefined,
        body: formData.get("body") ?? undefined,
        image_url: formData.get("image_url") ?? undefined,
        cta_label: formData.get("cta_label"),
        cta_href: formData.get("cta_href"),
      };
      break;
    case "text":
      rawContent = {
        heading: formData.get("heading"),
        body: formData.get("body"),
      };
      break;
    case "gallery":
      rawContent = {
        heading: formData.get("heading"),
        image_ids: formData.getAll("image_ids") as string[],
      };
      break;
    case "faq":
      rawContent = {
        heading: formData.get("heading"),
        category: formData.get("category"),
      };
      break;
  }

  let content;
  try {
    content = parseSectionContent(type, rawContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid content";
    redirect(`/admin/pages/${slug}?error=${encodeURIComponent(msg)}`);
  }

  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const isVisible = formData.get("is_visible") === "on";

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("page_sections")
    .select("*")
    .eq("id", id)
    .single();

  const update = {
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_visible: isVisible,
    content,
  };
  const { error } = await supabase
    .from("page_sections")
    .update(update)
    .eq("id", id);
  if (error) redirect(`/admin/pages/${slug}?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "page_sections",
    entityId: id,
    oldValues: oldRow,
    newValues: update,
  });

  revalidatePath(`/admin/pages/${slug}`);
  if (slug === "home") revalidatePath("/");
  redirect(`/admin/pages/${slug}?saved=1`);
}

export async function deleteSection(formData: FormData) {
  const slug = formData.get("slug") as string;
  const id = formData.get("id") as string;
  if (!slug || !id) redirect(`/admin/pages?error=Missing+id`);

  const supabase = await createServerClient();
  const { data: oldRow } = await supabase
    .from("page_sections")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("page_sections").delete().eq("id", id);
  if (error) redirect(`/admin/pages/${slug}?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "delete",
    entityType: "page_sections",
    entityId: id,
    oldValues: oldRow,
  });

  revalidatePath(`/admin/pages/${slug}`);
  if (slug === "home") revalidatePath("/");
  redirect(`/admin/pages/${slug}?saved=1`);
}
