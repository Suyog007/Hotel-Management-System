import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageSquareQuote } from "lucide-react";
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

      <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <strong>Heads up:</strong> the homepage reviews slider shows these
        quotes only while fewer than 3 Google reviews are cached. Once the
        Google cache has 3 or more, the slider switches to Google reviews and
        testimonials no longer appear on the homepage. When shown, up to 8
        visible testimonials render, sorted by Order.
      </div>

      {sp.saved && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>
      )}
      {sp.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New testimonial</CardTitle>
        </CardHeader>
        <CardContent>
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
              <div className="space-y-2">
                <Label htmlFor="new_image_url">Avatar URL</Label>
                <Input id="new_image_url" name="image_url" placeholder="https://…" />
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
            <SubmitButton>Add testimonial</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rows.length === 0 && (
          <EmptyState
            icon={MessageSquareQuote}
            title="No testimonials yet"
            description="Add curated guest quotes that you'd like to highlight on your site."
          />
        )}
        {rows.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-6">
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
                  <Textarea name="body" defaultValue={t.body} required />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <Input name="rating" type="number" min="1" max="5" defaultValue={t.rating ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label>Avatar URL</Label>
                    <Input name="image_url" defaultValue={t.image_url ?? ""} />
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
                <SubmitButton>Save</SubmitButton>
              </form>

              <form action={deleteTestimonial} className="mt-2">
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton variant="destructive" size="sm">Delete</SubmitButton>
              </form>
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
