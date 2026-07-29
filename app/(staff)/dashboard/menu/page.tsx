import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
import { createFoodItem, deleteFoodItem, updateFoodItem } from "./actions";

type FoodRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

const MANAGER_PLUS = new Set(["manager", "super_admin"]);

export default async function DashboardMenuPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/menu");
  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const role = (actor as { role: string } | null)?.role ?? "guest";
  if (!MANAGER_PLUS.has(role)) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Manager access required</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const { data } = await supabase.from("food_items").select("*").order("category").order("sort_order");
  const rows = (data as FoodRow[] | null) ?? [];

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="From the kitchen"
        title="Food menu"
        description="Shown on the public menu page. Browse-only — no ordering."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <CreatePanel title="New item" description="add a dish or drink to the menu">
        <form action={createFoodItem} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new_name">Name</Label>
              <Input id="new_name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_category">Category</Label>
              <Input id="new_category" name="category" required placeholder="Breakfast, Lunch, Drinks…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_price">Price ({symbol})</Label>
              <Input id="new_price" name="price" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_sort_order">Sort order</Label>
              <Input id="new_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_description">Description</Label>
            <Textarea id="new_description" name="description" />
          </div>
          <ImageUploadField
            name="image_url"
            fileName="image_file"
            label="Photo"
            hint="Optional. PNG, JPEG, WebP or GIF, max 10 MB."
          />
          <div className="flex items-center gap-3">
            <Switch id="new_is_available" name="is_available" defaultChecked />
            <Label htmlFor="new_is_available">Available</Label>
          </div>
          <FormActions>
            <SubmitButton size="sm">Add item</SubmitButton>
          </FormActions>
        </form>
      </CreatePanel>

      <ManageList
        storageKey="menu"
        noun="items"
        searchPlaceholder="Search dishes, drinks, categories…"
        groupAllLabel="All categories"
        emptyLabel="No food items yet."
        items={rows.map((f) => ({
          id: f.id,
          title: f.name,
          subtitle: f.description,
          meta: `${symbol} ${f.price}`,
          group: f.category,
          badge: f.is_available ? null : { label: "Hidden", variant: "outline" as const },
          thumbnail: f.image_url,
          search: f.description ?? "",
          children: (
            <form action={updateFoodItem} className="space-y-4">
              <input type="hidden" name="id" value={f.id} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" defaultValue={f.name} required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input name="category" defaultValue={f.category} required />
                </div>
                <div className="space-y-2">
                  <Label>Price ({symbol})</Label>
                  <Input name="price" type="number" min="0" step="0.01" defaultValue={String(f.price)} required />
                </div>
                <div className="space-y-2">
                  <Label>Sort order</Label>
                  <Input name="sort_order" type="number" min="0" defaultValue={f.sort_order} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" defaultValue={f.description ?? ""} />
              </div>
              <ImageUploadField
                name="image_url"
                fileName="image_file"
                label="Photo"
                value={f.image_url ?? ""}
              />
              <div className="flex items-center gap-3">
                <Switch name="is_available" defaultChecked={f.is_available} />
                <Label>Available</Label>
              </div>
              <FormActions>
                <SubmitButton size="sm">Save</SubmitButton>
                <DeleteButton
                  action={deleteFoodItem}
                  confirmMessage={`Delete “${f.name}” from the menu? This can't be undone.`}
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
