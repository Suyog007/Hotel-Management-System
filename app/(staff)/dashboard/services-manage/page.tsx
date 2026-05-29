import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SERVICE_CATEGORIES } from "@/lib/validation/services";
import { createService, deleteService, updateService } from "./actions";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: "spa" | "laundry" | "transport" | "food" | "other";
  price: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

const MANAGER_PLUS = new Set(["manager", "super_admin"]);

export default async function DashboardServicesPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/services-manage");
  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const role = (actor as { role: string } | null)?.role ?? "guest";
  if (!MANAGER_PLUS.has(role)) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader><CardTitle>Manager access required</CardTitle></CardHeader>
      </Card>
    );
  }

  const { data } = await supabase
    .from("services")
    .select("*")
    .order("category")
    .order("sort_order");
  const rows = (data as ServiceRow[] | null) ?? [];

  const { data: settings } = await supabase.from("site_settings").select("currency_symbol").single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="On the property"
        title="Services"
        description="Spa, laundry, transport, etc. — guests can request these from their booking."
      />

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      <Card>
        <CardHeader><CardTitle>New service</CardTitle></CardHeader>
        <CardContent>
          <form action={createService} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select name="category" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue="other">
                  {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Price ({symbol}, optional)</Label>
                <Input name="price" type="number" min="0" step="0.01" />
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
              <Switch name="is_active" defaultChecked />
              <Label>Active</Label>
            </div>
            <Button type="submit">Add service</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-6">
              <form action={updateService} className="space-y-4">
                <input type="hidden" name="id" value={s.id} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input name="name" defaultValue={s.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select name="category" defaultValue={s.category} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input name="price" type="number" min="0" step="0.01" defaultValue={s.price ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort order</Label>
                    <Input name="sort_order" type="number" min="0" defaultValue={s.sort_order} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea name="description" defaultValue={s.description ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input name="image_url" defaultValue={s.image_url ?? ""} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch name="is_active" defaultChecked={s.is_active} />
                  <Label>Active</Label>
                </div>
                <Button type="submit" size="sm">Save</Button>
              </form>
              <form action={deleteService} className="mt-2">
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="destructive" size="sm">Delete</Button>
              </form>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No services yet.</p>}
      </div>
    </div>
  );
}
