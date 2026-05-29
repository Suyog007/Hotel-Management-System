import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      <Card>
        <CardHeader><CardTitle>New item</CardTitle></CardHeader>
        <CardContent>
          <form action={createFoodItem} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input name="category" required placeholder="Breakfast, Lunch, Drinks…" />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input name="price" type="number" min="0" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input name="sort_order" type="number" min="0" defaultValue="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input name="image_url" placeholder="https://…" />
            </div>
            <div className="flex items-center gap-3">
              <Switch name="is_available" defaultChecked />
              <Label>Available</Label>
            </div>
            <Button type="submit">Add item</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.map((f) => (
          <Card key={f.id}>
            <CardContent className="pt-6">
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
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input name="image_url" defaultValue={f.image_url ?? ""} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch name="is_available" defaultChecked={f.is_available} />
                  <Label>Available</Label>
                </div>
                <Button type="submit" size="sm">Save</Button>
              </form>
              <form action={deleteFoodItem} className="mt-2">
                <input type="hidden" name="id" value={f.id} />
                <Button type="submit" variant="destructive" size="sm">Delete</Button>
              </form>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No food items yet.</p>}
      </div>
    </div>
  );
}
