import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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

export default async function AdminTestimonialsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  const rows = (data as TestimonialRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Editorial"
        title="Testimonials"
        description="Curated quotes from past guests. These render on your site separately from Google Reviews."
      />

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
            <Button type="submit">Add testimonial</Button>
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
                <Button type="submit">Save</Button>
              </form>

              <form action={deleteTestimonial} className="mt-2">
                <input type="hidden" name="id" value={t.id} />
                <Button type="submit" variant="destructive" size="sm">Delete</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
