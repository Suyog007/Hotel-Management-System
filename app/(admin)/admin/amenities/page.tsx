import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
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

      <StatusNote saved={sp.saved} error={sp.error} />

      <CreatePanel title="New amenity" description="wifi, parking, pool…">
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
            <div className="flex items-end gap-3">
              <Switch id="new_is_visible" name="is_visible" defaultChecked />
              <Label htmlFor="new_is_visible">Visible</Label>
            </div>
          </div>
          <FormActions>
            <SubmitButton size="sm">Add amenity</SubmitButton>
          </FormActions>
        </form>
      </CreatePanel>

      <ManageList
        storageKey="amenities"
        noun="amenities"
        searchPlaceholder="Search amenities…"
        emptyLabel="No amenities yet — add Wi-Fi, parking, pool and other perks above."
        items={rows.map((a) => ({
          id: a.id,
          title: a.name,
          subtitle: a.description,
          meta: `#${a.sort_order}`,
          badge: a.is_visible ? null : { label: "Hidden", variant: "outline" as const },
          search: a.icon ?? "",
          children: (
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
                <div className="flex items-end gap-3">
                  <Switch id={`v-${a.id}`} name="is_visible" defaultChecked={a.is_visible} />
                  <Label htmlFor={`v-${a.id}`}>Visible</Label>
                </div>
              </div>
              <FormActions>
                <SubmitButton size="sm">Save</SubmitButton>
                <DeleteButton
                  action={deleteAmenity}
                  confirmMessage={`Delete the “${a.name}” amenity?`}
                  className="ml-auto"
                />
              </FormActions>
            </form>
          ),
        }))}
      />
    </div>
  );
}
