import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
import { Pager } from "@/components/ui/pager";
import {
  createTestimonial,
  deleteTestimonial,
  updateTestimonial,
} from "./actions";

type TestimonialRow = {
  id: string;
  author_name: string;
  author_role: string | null;
  body: string;
  rating: number | null;
  image_url: string | null;
  sort_order: number;
  is_visible: boolean;
};

const PAGE_SIZE = 50;

export default async function AdminTestimonialsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createServerClient();
  const { data, count } = await supabase
    .from("testimonials")
    .select("*", { count: "exact" })
    .order("sort_order")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  const rows = (data as TestimonialRow[] | null) ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Editorial"
        title="Testimonials"
        description="Curated quotes from past guests. These render on your site separately from Google Reviews."
      />

      <details className="group rounded-md border bg-muted/40 text-sm text-muted-foreground">
        <summary className="cursor-pointer list-none px-4 py-2.5 font-medium text-foreground [&::-webkit-details-marker]:hidden">
          When do these show on the homepage?
        </summary>
        <div className="border-t px-4 py-3">
          The homepage reviews slider shows these quotes only while fewer than 3
          Google reviews are cached. Once the Google cache has 3 or more, the
          slider switches to Google reviews and testimonials no longer appear on
          the homepage. When shown, up to 8 visible testimonials render, sorted
          by Order.
        </div>
      </details>

      <StatusNote saved={sp.saved} error={sp.error} />

      <CreatePanel title="New testimonial" description="a curated guest quote">
        <form action={createTestimonial} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new_author_name">Author name</Label>
              <Input id="new_author_name" name="author_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_author_role">Role</Label>
              <Input id="new_author_role" name="author_role" placeholder="e.g. Business traveler" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_body">Quote</Label>
            <Textarea id="new_body" name="body" required />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="new_rating">Rating (1-5)</Label>
              <Input id="new_rating" name="rating" type="number" min="1" max="5" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <ImageUploadField
                name="image_url"
                fileName="image_file"
                label="Avatar"
                hint="Optional headshot. Max 10 MB."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_sort_order">Order</Label>
              <Input id="new_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="new_is_visible" name="is_visible" defaultChecked />
            <Label htmlFor="new_is_visible">Visible</Label>
          </div>
          <FormActions>
            <SubmitButton size="sm">Add testimonial</SubmitButton>
          </FormActions>
        </form>
      </CreatePanel>

      <ManageList
        storageKey="testimonials"
        noun="testimonials"
        searchPlaceholder="Search authors and quotes…"
        emptyLabel="No testimonials yet — add guest quotes you'd like to highlight."
        items={rows.map((t) => ({
          id: t.id,
          title: t.author_name,
          subtitle: t.body,
          meta: t.rating ? `${t.rating}★` : null,
          badge: t.is_visible ? null : { label: "Hidden", variant: "outline" as const },
          thumbnail: t.image_url,
          search: `${t.author_role ?? ""} ${t.body}`,
          children: (
            <form action={updateTestimonial} className="space-y-4">
              <input type="hidden" name="id" value={t.id} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Author name</Label>
                  <Input name="author_name" defaultValue={t.author_name} required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input name="author_role" defaultValue={t.author_role ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quote</Label>
                <Textarea name="body" defaultValue={t.body} required rows={4} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <Input name="rating" type="number" min="1" max="5" defaultValue={t.rating ?? ""} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <ImageUploadField
                    name="image_url"
                    fileName="image_file"
                    label="Avatar"
                    value={t.image_url ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Input name="sort_order" type="number" min="0" defaultValue={t.sort_order} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch name="is_visible" defaultChecked={t.is_visible} />
                <Label>Visible</Label>
              </div>
              <FormActions>
                <SubmitButton size="sm">Save</SubmitButton>
                <DeleteButton
                  action={deleteTestimonial}
                  confirmMessage={`Delete the testimonial from ${t.author_name}?`}
                  className="ml-auto"
                />
              </FormActions>
            </form>
          ),
        }))}
      />

      {pages > 1 && <Pager page={page} pages={pages} sp={sp} />}
    </div>
  );
}

