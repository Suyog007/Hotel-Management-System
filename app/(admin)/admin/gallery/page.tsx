import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { StatusNote } from "@/components/ui/status-note";
import { EmptyState } from "@/components/ui/empty-state";
import { Image as ImageIcon, Pencil } from "lucide-react";
import {
  deleteGalleryImage,
  updateGalleryImage,
  uploadGalleryImage,
} from "./actions";

type GalleryRow = {
  id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
  is_visible: boolean;
};

// Visual grid — a larger page than the 50-row list pages.
const PAGE_SIZE = 24;

export default async function AdminGalleryPage(props: {
  searchParams: Promise<{ saved?: string; error?: string; page?: string; category?: string }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createServerClient();

  // Category chips are built from the whole library, not just this page.
  const { data: allCategories } = await supabase
    .from("gallery_images")
    .select("category");
  const categories = Array.from(
    new Set(
      ((allCategories as { category: string | null }[] | null) ?? [])
        .map((r) => r.category)
        .filter((c): c is string => Boolean(c)),
    ),
  ).sort();

  const active = sp.category && categories.includes(sp.category) ? sp.category : null;

  let query = supabase
    .from("gallery_images")
    .select("*", { count: "exact" })
    .order("sort_order")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (active) query = query.eq("category", active);

  const { data, count } = await query;
  const rows = (data as GalleryRow[] | null) ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const chipHref = (category: string | null) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Images"
        title="Gallery"
        description="Uploads go to the public-images bucket. PNG / JPEG / WebP / GIF / SVG, max 10 MB."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <CreatePanel title="Upload image" description="PNG / JPEG / WebP / GIF / SVG, max 10 MB">
        <form action={uploadGalleryImage} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" accept="image/*" required />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="upload_caption">Caption</Label>
              <Input id="upload_caption" name="caption" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload_category">Category</Label>
              <Input id="upload_category" name="category" placeholder="rooms, exterior, food" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="upload_sort_order">Order</Label>
              <Input id="upload_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
            </div>
            <div className="flex items-end gap-3">
              <Switch id="upload_is_visible" name="is_visible" defaultChecked />
              <Label htmlFor="upload_is_visible">Visible</Label>
            </div>
          </div>
          <FormActions>
            <SubmitButton size="sm" pendingLabel="Uploading…">Upload</SubmitButton>
          </FormActions>
        </form>
      </CreatePanel>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={chipHref(null)}
            className={`h-9 rounded-full border px-3 text-sm leading-[calc(2.25rem-2px)] transition-colors ${
              active === null
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            All
          </a>
          {categories.map((c) => (
            <a
              key={c}
              href={chipHref(c)}
              className={`h-9 rounded-full border px-3 text-sm leading-[calc(2.25rem-2px)] transition-colors ${
                active === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {c}
            </a>
          ))}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {total} image{total === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {rows.length === 0 && (
        <EmptyState
          icon={ImageIcon}
          title="No images yet"
          description="Upload your first image using the panel above. It'll show up in the gallery and be available to pick into page sections."
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <Card key={g.id} className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.image_url}
              alt={g.caption ?? ""}
              className="aspect-video w-full border-b object-cover"
            />
            <CardContent className="space-y-2 p-3">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {g.caption || <span className="text-muted-foreground">No caption</span>}
                </p>
                {!g.is_visible && <Badge variant="outline">Hidden</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {g.category || "Uncategorised"} · #{g.sort_order}
              </p>

              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                  <span className="group-open:hidden">Edit</span>
                  <span className="hidden group-open:inline">Close</span>
                </summary>
                <form action={updateGalleryImage} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="image_url" value={g.image_url} />
                  <div className="space-y-2">
                    <Label htmlFor={`replace-${g.id}`}>Replace photo</Label>
                    <input
                      id={`replace-${g.id}`}
                      type="file"
                      name="image_file"
                      accept="image/*"
                      className="block w-full cursor-pointer rounded-md border border-input bg-card text-sm text-muted-foreground shadow-sm transition-colors hover:border-foreground/30 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to keep the current photo. The old file is deleted on replace.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Caption</Label>
                    <Input name="caption" defaultValue={g.caption ?? ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input name="category" defaultValue={g.category ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Order</Label>
                      <Input name="sort_order" type="number" min="0" defaultValue={g.sort_order} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch name="is_visible" defaultChecked={g.is_visible} />
                    <Label>Visible</Label>
                  </div>
                  <FormActions>
                    <SubmitButton size="sm">Save</SubmitButton>
                    <DeleteButton
                      action={deleteGalleryImage}
                      confirmMessage="Delete this image? This can't be undone."
                      className="ml-auto"
                    />
                  </FormActions>
                </form>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      {pages > 1 && <Pager page={page} pages={pages} sp={sp} />}
    </div>
  );
}

function Pager({
  page,
  pages,
  sp,
}: {
  page: number;
  pages: number;
  sp: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") params.set(k, v);
  }
  const prev = page > 1 ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page - 1) })}` : null;
  const next = page < pages ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page + 1) })}` : null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        {prev && <a href={prev} className="rounded-md border px-3 py-1.5 hover:bg-muted">← Prev</a>}
        {next && <a href={next} className="rounded-md border px-3 py-1.5 hover:bg-muted">Next →</a>}
      </div>
    </div>
  );
}
