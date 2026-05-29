import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

      {sp.saved && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          Saved.
        </div>
      )}
      {sp.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sp.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Page meta</CardTitle>
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
            <Button type="submit">Save page</Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Sections</h2>
        <div className="space-y-4">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No sections yet — add one below.</p>
          )}
          {rows.map((s) => (
            <SectionEditor key={s.id} section={s} slug={slug} gallery={gallery} />
          ))}
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Add section</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSection} className="flex items-end gap-3">
              <input type="hidden" name="slug" value={slug} />
              <div className="space-y-2">
                <Label htmlFor="section_type">Type</Label>
                <select
                  id="section_type"
                  name="section_type"
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="text"
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs uppercase">
            {section.section_type}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
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

          <Button type="submit">Save section</Button>
        </form>

        <form action={deleteSection} className="mt-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={section.id} />
          <Button type="submit" variant="destructive" size="sm">
            Delete section
          </Button>
        </form>
      </CardContent>
    </Card>
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
