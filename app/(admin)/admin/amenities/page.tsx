import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";
import { createAmenity, deleteAmenity, updateAmenity } from "./actions";

type AmenityRow = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
};

export default async function AdminAmenitiesPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("amenities")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const rows = (data as AmenityRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Public content"
        title="Amenities"
        description="Hotel-level amenities (wifi, parking, pool) shown on the public site and home page."
      />

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
          <CardTitle>New amenity</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAmenity} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_name">Name</Label>
                <Input id="new_name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_icon">
                  Icon <span className="text-xs text-muted-foreground">(lucide name)</span>
                </Label>
                <Input id="new_icon" name="icon" placeholder="wifi" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_description">Description</Label>
              <Textarea id="new_description" name="description" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_sort_order">Order</Label>
                <Input id="new_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_is_visible">Visible</Label>
                <Switch id="new_is_visible" name="is_visible" defaultChecked />
              </div>
            </div>
            <Button type="submit">Add amenity</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rows.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title="No amenities yet"
            description="Add Wi-Fi, parking, pool, and other hotel-level perks above."
          />
        )}
        {rows.map((a) => (
          <Card key={a.id}>
            <CardContent className="pt-6">
              <form action={updateAmenity} className="space-y-4">
                <input type="hidden" name="id" value={a.id} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`n-${a.id}`}>Name</Label>
                    <Input id={`n-${a.id}`} name="name" defaultValue={a.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`i-${a.id}`}>Icon</Label>
                    <Input id={`i-${a.id}`} name="icon" defaultValue={a.icon ?? ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`d-${a.id}`}>Description</Label>
                  <Textarea id={`d-${a.id}`} name="description" defaultValue={a.description ?? ""} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`o-${a.id}`}>Order</Label>
                    <Input id={`o-${a.id}`} name="sort_order" type="number" min="0" defaultValue={a.sort_order} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`v-${a.id}`}>Visible</Label>
                    <Switch id={`v-${a.id}`} name="is_visible" defaultChecked={a.is_visible} />
                  </div>
                </div>
                <Button type="submit">Save</Button>
              </form>

              <form action={deleteAmenity} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" variant="destructive" size="sm">
                  Delete
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
