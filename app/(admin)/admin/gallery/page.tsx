import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Image as ImageIcon } from "lucide-react";
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

export default async function AdminGalleryPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("gallery_images")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  const rows = (data as GalleryRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Images"
        title="Gallery"
        description="Uploads go to the public-images bucket. PNG / JPEG / WebP / GIF / SVG, max 10 MB."
      />

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Upload image</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Button type="submit">Upload</Button>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 && (
        <EmptyState
          icon={ImageIcon}
          title="No images yet"
          description="Upload your first image using the form above. It'll show up in the gallery and be available to pick into page sections."
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((g) => (
          <Card key={g.id}>
            <CardContent className="space-y-4 pt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.image_url}
                alt={g.caption ?? ""}
                className="aspect-video w-full rounded-md border object-cover"
              />
              <form action={updateGalleryImage} className="space-y-3">
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="image_url" value={g.image_url} />
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
                <Button type="submit" size="sm">Save</Button>
              </form>

              <form action={deleteGalleryImage}>
                <input type="hidden" name="id" value={g.id} />
                <Button type="submit" variant="destructive" size="sm">Delete</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
