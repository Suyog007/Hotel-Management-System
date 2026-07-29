import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
import { ChevronLeft } from "lucide-react";
import { SECTION_TYPES, type SectionType } from "@/lib/validation/sections";
import {
  createSection,
  deleteSection,
  updatePageMeta,
  updateSection,
} from "./actions";

type PageRow = {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
};

type SectionRow = {
  id: string;
  section_type: SectionType;
  sort_order: number;
  is_visible: boolean;
  content: Record<string, unknown>;
};

type GalleryRow = { id: string; image_url: string; caption: string | null };

export default async function AdminPageEditor(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);

  const supabase = await createServerClient();
  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!page) notFound();
  const p = page as PageRow;

  const { data: sections } = await supabase
    .from("page_sections")
    .select("*")
    .eq("page_id", p.id)
    .order("sort_order", { ascending: true });
  const rows = (sections as SectionRow[] | null) ?? [];

  // Gallery section editor needs available images
  const needsGallery = rows.some((s) => s.section_type === "gallery");
  let gallery: GalleryRow[] = [];
  if (needsGallery) {
    const { data: g } = await supabase
      .from("gallery_images")
      .select("id, image_url, caption")
      .order("sort_order");
    gallery = (g as GalleryRow[] | null) ?? [];
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/pages"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All pages
        </Link>
        <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Edit page
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {p.title}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              /{slug === "home" ? "" : slug}
            </p>
          </div>
          <Badge variant={p.is_published ? "success" : "outline"}>
            {p.is_published ? "Published" : "Draft"}
          </Badge>
        </header>
      </div>

      <StatusNote saved={sp.saved} error={sp.error} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Page meta</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updatePageMeta} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={p.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_title">SEO title</Label>
              <Input id="meta_title" name="meta_title" defaultValue={p.meta_title ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_description">SEO description</Label>
              <Textarea
                id="meta_description"
                name="meta_description"
                defaultValue={p.meta_description ?? ""}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="is_published" name="is_published" defaultChecked={p.is_published} />
              <Label htmlFor="is_published">Published</Label>
            </div>
            <FormActions>
              <SubmitButton size="sm">Save page</SubmitButton>
            </FormActions>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Sections</h2>
          <p className="text-sm text-muted-foreground">
            Blocks rendered top-to-bottom on the page, in Order.
          </p>
        </div>

        <CreatePanel title="Add section" description="hero, text, gallery, CTA, FAQ">
          <form action={createSection} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-2">
              <Label htmlFor="section_type">Type</Label>
              <Select id="section_type" name="section_type" defaultValue="text" className="w-48">
                {SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <SubmitButton size="sm">Add</SubmitButton>
          </form>
        </CreatePanel>

        <ManageList
          storageKey={`page-sections:${slug}`}
          noun="sections"
          searchPlaceholder="Search sections…"
          emptyLabel="No sections yet — add one above."
          items={rows.map((s) => ({
            id: s.id,
            title: s.section_type,
            subtitle: sectionSummary(s),
            meta: `#${s.sort_order}`,
            badge: s.is_visible ? null : { label: "Hidden", variant: "outline" as const },
            children: <SectionEditor section={s} slug={slug} gallery={gallery} />,
          }))}
        />
      </section>
    </div>
  );
}

/** One-line preview of a section's content for the collapsed row. */
function sectionSummary(section: SectionRow) {
  const c = section.content ?? {};
  const first = ["heading", "subheading", "body", "cta_label", "category"]
    .map((k) => c[k])
    .find((v) => typeof v === "string" && v.trim().length > 0);
  if (typeof first === "string") return first;
  const ids = c.image_ids as string[] | undefined;
  if (ids?.length) return `${ids.length} image${ids.length === 1 ? "" : "s"} selected`;
  return "Empty — open to fill in";
}

function SectionEditor({
  section,
  slug,
  gallery,
}: {
  section: SectionRow;
  slug: string;
  gallery: GalleryRow[];
}) {
  return (
    <form action={updateSection} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={section.id} />
      <input type="hidden" name="section_type" value={section.section_type} />

      <SectionFields section={section} gallery={gallery} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`order-${section.id}`}>Order</Label>
          <Input
            id={`order-${section.id}`}
            name="sort_order"
            type="number"
            min="0"
            defaultValue={section.sort_order}
          />
        </div>
        <div className="flex items-end gap-3">
          <Switch
            id={`vis-${section.id}`}
            name="is_visible"
            defaultChecked={section.is_visible}
          />
          <Label htmlFor={`vis-${section.id}`}>Visible</Label>
        </div>
      </div>

      <FormActions>
        <SubmitButton size="sm">Save section</SubmitButton>
        <DeleteButton
          action={deleteSection}
          confirmMessage={`Delete this ${section.section_type} section?`}
          className="ml-auto"
        >
          Delete section
        </DeleteButton>
      </FormActions>
    </form>
  );
}

function SectionFields({
  section,
  gallery,
}: {
  section: SectionRow;
  gallery: GalleryRow[];
}) {
  const c = section.content ?? {};
  const v = (key: string) => (c[key] as string | undefined) ?? "";

  switch (section.section_type) {
    case "hero":
      return (
        <>
          <FormField id={`h-${section.id}`} name="heading" label="Heading" value={v("heading")} />
          <FormField id={`sh-${section.id}`} name="subheading" label="Subheading" value={v("subheading")} />
          <FormField id={`img-${section.id}`} name="image_url" label="Image URL" value={v("image_url")} placeholder="https://…" />
          <FormField id={`cl-${section.id}`} name="cta_label" label="CTA label" value={v("cta_label")} placeholder="Book now" />
          <FormField id={`ch-${section.id}`} name="cta_href" label="CTA href" value={v("cta_href")} placeholder="/rooms" />
        </>
      );
    case "text":
      return (
        <>
          <FormField id={`h-${section.id}`} name="heading" label="Heading" value={v("heading")} />
          <FormFieldArea id={`b-${section.id}`} name="body" label="Body" value={v("body")} />
        </>
      );
    case "gallery": {
      const selected = new Set(((c.image_ids as string[] | undefined) ?? []));
      return (
        <>
          <FormField id={`h-${section.id}`} name="heading" label="Heading" value={v("heading")} />
          <div className="space-y-2">
            <Label>Pick images</Label>
            {gallery.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No gallery images yet. Upload some on the Gallery page first.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {gallery.map((g) => (
                <label
                  key={g.id}
                  className="relative block cursor-pointer overflow-hidden rounded-md border bg-card"
                >
                  <input
                    type="checkbox"
                    name="image_ids"
                    value={g.id}
                    defaultChecked={selected.has(g.id)}
                    className="absolute right-2 top-2 z-10 h-4 w-4"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image_url} alt={g.caption ?? ""} className="aspect-square w-full object-cover" />
                </label>
              ))}
            </div>
          </div>
        </>
      );
    }
    case "cta":
      return (
        <>
          <FormField id={`h-${section.id}`} name="heading" label="Heading" value={v("heading")} />
          <FormFieldArea id={`b-${section.id}`} name="body" label="Body" value={v("body")} />
          <FormField id={`cl-${section.id}`} name="cta_label" label="CTA label" value={v("cta_label")} />
          <FormField id={`ch-${section.id}`} name="cta_href" label="CTA href" value={v("cta_href")} />
        </>
      );
    case "faq":
      return (
        <>
          <FormField id={`h-${section.id}`} name="heading" label="Heading" value={v("heading")} />
          <FormField id={`c-${section.id}`} name="category" label="Category filter (optional)" value={v("category")} placeholder="leave empty to show all visible FAQs" />
        </>
      );
  }
}

function FormField(props: {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input id={props.id} name={props.name} defaultValue={props.value} placeholder={props.placeholder} />
    </div>
  );
}

function FormFieldArea(props: {
  id: string;
  name: string;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Textarea id={props.id} name={props.name} defaultValue={props.value} rows={5} />
    </div>
  );
}
