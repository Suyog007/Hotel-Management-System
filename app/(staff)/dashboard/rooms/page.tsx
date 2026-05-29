import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  createRoom,
  createRoomType,
  deleteRoom,
  deleteRoomType,
  updateRoom,
  updateRoomType,
} from "./actions";

type RoomTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  max_guests: number;
  amenities: string[] | null;
  images: string[] | null;
  is_active: boolean;
  sort_order: number;
};

type RoomRow = {
  id: string;
  room_number: string;
  type_id: string;
  floor: number | null;
  status: "available" | "occupied" | "maintenance" | "cleaning";
  notes: string | null;
};

export default async function DashboardRoomsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/rooms");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const role = (profile?.role as string | undefined) ?? "guest";
  if (role !== "manager" && role !== "super_admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Manager access required</CardTitle>
            <CardDescription>
              Rooms management is restricted to managers and super admins.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [typesRes, roomsRes] = await Promise.all([
    supabase.from("room_types").select("*").order("sort_order"),
    supabase.from("rooms").select("*").order("room_number"),
  ]);
  const types = (typesRes.data as RoomTypeRow[] | null) ?? [];
  const rooms = (roomsRes.data as RoomRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Rooms"
        description="Set room types (and their single base price) and assign physical rooms to each type."
      />

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      {/* ── Room types ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Room types</h2>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>New room type</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createRoomType} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" required />
                </div>
                <div className="space-y-2">
                  <Label>Slug (auto if blank)</Label>
                  <Input name="slug" placeholder="deluxe" />
                </div>
                <div className="space-y-2">
                  <Label>Base price</Label>
                  <Input name="base_price" type="number" min="0" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label>Max guests</Label>
                  <Input name="max_guests" type="number" min="1" max="20" defaultValue="2" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea name="description" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amenities (one per line)</Label>
                  <Textarea name="amenities" rows={4} placeholder={"Wi-Fi\nAC\nMini-fridge"} />
                </div>
                <div className="space-y-2">
                  <Label>Image URLs (one per line)</Label>
                  <Textarea name="images" rows={4} placeholder={"https://…\nhttps://…"} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sort order</Label>
                  <Input name="sort_order" type="number" min="0" defaultValue="0" />
                </div>
                <div className="flex items-end gap-3">
                  <Switch name="is_active" defaultChecked />
                  <Label>Active</Label>
                </div>
              </div>
              <Button type="submit">Add room type</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {types.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-6">
                <form action={updateRoomType} className="space-y-4">
                  <input type="hidden" name="id" value={t.id} />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input name="name" defaultValue={t.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input name="slug" defaultValue={t.slug} />
                    </div>
                    <div className="space-y-2">
                      <Label>Base price</Label>
                      <Input name="base_price" type="number" min="0" step="0.01" defaultValue={String(t.base_price)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Max guests</Label>
                      <Input name="max_guests" type="number" min="1" max="20" defaultValue={t.max_guests} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea name="description" defaultValue={t.description ?? ""} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Amenities (one per line)</Label>
                      <Textarea name="amenities" rows={4} defaultValue={(t.amenities ?? []).join("\n")} />
                    </div>
                    <div className="space-y-2">
                      <Label>Image URLs (one per line)</Label>
                      <Textarea name="images" rows={4} defaultValue={(t.images ?? []).join("\n")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sort order</Label>
                      <Input name="sort_order" type="number" min="0" defaultValue={t.sort_order} />
                    </div>
                    <div className="flex items-end gap-3">
                      <Switch name="is_active" defaultChecked={t.is_active} />
                      <Label>Active</Label>
                    </div>
                  </div>
                  <Button type="submit">Save</Button>
                </form>

                <form action={deleteRoomType} className="mt-2">
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" variant="destructive" size="sm">Delete room type</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Rooms ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Rooms</h2>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>New room</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createRoom} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Room number</Label>
                  <Input name="room_number" required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    name="type_id"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input name="floor" type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    name="status"
                    defaultValue="available"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="available">available</option>
                    <option value="occupied">occupied</option>
                    <option value="maintenance">maintenance</option>
                    <option value="cleaning">cleaning</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea name="notes" />
              </div>
              <Button type="submit">Add room</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {rooms.length === 0 && (
            <p className="text-sm text-muted-foreground">No rooms yet.</p>
          )}
          {rooms.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <form action={updateRoom} className="space-y-4">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Room number</Label>
                      <Input name="room_number" defaultValue={r.room_number} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select
                        name="type_id"
                        defaultValue={r.type_id}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Floor</Label>
                      <Input name="floor" type="number" defaultValue={r.floor ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        name="status"
                        defaultValue={r.status}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="available">available</option>
                        <option value="occupied">occupied</option>
                        <option value="maintenance">maintenance</option>
                        <option value="cleaning">cleaning</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea name="notes" defaultValue={r.notes ?? ""} rows={2} />
                  </div>
                  <Button type="submit" size="sm">Save</Button>
                </form>

                <form action={deleteRoom} className="mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit" variant="destructive" size="sm">Delete</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
