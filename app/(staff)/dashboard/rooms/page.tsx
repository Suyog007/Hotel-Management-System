import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
import { roomStatusBadge } from "@/components/ui/badge";
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
  original_price: number | null;
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

const ROOM_STATUSES = ["available", "occupied", "maintenance", "cleaning"] as const;

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

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const roomCount = new Map<string, number>();
  for (const r of rooms) roomCount.set(r.type_id, (roomCount.get(r.type_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Inventory"
        title="Rooms"
        description="Set room types (and their single base price) and assign physical rooms to each type."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      {/* ── Room types ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Room types</h2>
          <p className="text-sm text-muted-foreground">
            The bookable products — price, photos and amenities live here.
          </p>
        </div>

        <CreatePanel title="New room type" description="e.g. Deluxe, Premium Suite">
          <form action={createRoomType} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nt_name">Name</Label>
                <Input id="nt_name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt_slug">Slug (auto if blank)</Label>
                <Input id="nt_slug" name="slug" placeholder="deluxe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt_base_price">Base price</Label>
                <Input id="nt_base_price" name="base_price" type="number" min="0" step="0.01" required />
                <p className="text-xs text-muted-foreground">What the guest is charged per night.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt_original_price">Original price (optional)</Label>
                <Input id="nt_original_price" name="original_price" type="number" min="0" step="0.01" />
                <p className="text-xs text-muted-foreground">
                  Shown struck through next to the base price. Leave blank if no offer is running.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt_max_guests">Max guests</Label>
                <Input id="nt_max_guests" name="max_guests" type="number" min="1" max="20" defaultValue="2" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt_description">Description</Label>
              <Textarea id="nt_description" name="description" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nt_amenities">Amenities (one per line)</Label>
                <Textarea id="nt_amenities" name="amenities" rows={4} placeholder={"Wi-Fi\nAC\nMini-fridge"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt_images">Image URLs (one per line)</Label>
                <Textarea id="nt_images" name="images" rows={4} placeholder={"https://…\nhttps://…"} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nt_sort_order">Sort order</Label>
                <Input id="nt_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
              </div>
              <div className="flex items-end gap-3">
                <Switch id="nt_is_active" name="is_active" defaultChecked />
                <Label htmlFor="nt_is_active">Active</Label>
              </div>
            </div>
            <FormActions>
              <SubmitButton size="sm">Add room type</SubmitButton>
            </FormActions>
          </form>
        </CreatePanel>

        <ManageList
          storageKey="room-types"
          noun="room types"
          searchPlaceholder="Search room types…"
          emptyLabel="No room types yet."
          items={types.map((t) => ({
            id: t.id,
            title: t.name,
            subtitle: `${t.slug} · sleeps ${t.max_guests} · ${roomCount.get(t.id) ?? 0} room(s)`,
            meta: String(t.base_price),
            badge: t.is_active ? null : { label: "Inactive", variant: "outline" as const },
            thumbnail: t.images?.[0] ?? null,
            search: t.description ?? "",
            children: (
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
                    <Label>Original price (optional)</Label>
                    <Input
                      name="original_price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={t.original_price === null ? "" : String(t.original_price)}
                    />
                    <p className="text-xs text-muted-foreground">Struck through on the site. Blank = no offer.</p>
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
                <FormActions>
                  <SubmitButton size="sm">Save</SubmitButton>
                  <DeleteButton
                    action={deleteRoomType}
                    confirmMessage={`Delete the “${t.name}” room type? Rooms assigned to it may be affected.`}
                    className="ml-auto"
                  >
                    Delete room type
                  </DeleteButton>
                </FormActions>
              </form>
            ),
          }))}
        />
      </section>

      {/* ── Rooms ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Rooms</h2>
          <p className="text-sm text-muted-foreground">
            The physical keys, grouped by type. {rooms.length} total.
          </p>
        </div>

        <CreatePanel title="New room" description="assign a room number to a type">
          <form action={createRoom} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="nr_room_number">Room number</Label>
                <Input id="nr_room_number" name="room_number" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr_type_id">Type</Label>
                <Select id="nr_type_id" name="type_id" required>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr_floor">Floor</Label>
                <Input id="nr_floor" name="floor" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr_status">Status</Label>
                <Select id="nr_status" name="status" defaultValue="available">
                  {ROOM_STATUSES.map((s) => (
                    <option key={s} value={s}>{roomStatusBadge(s).label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nr_notes">Notes</Label>
              <Textarea id="nr_notes" name="notes" />
            </div>
            <FormActions>
              <SubmitButton size="sm">Add room</SubmitButton>
            </FormActions>
          </form>
        </CreatePanel>

        <ManageList
          storageKey="rooms"
          noun="rooms"
          searchPlaceholder="Search by room number, floor, notes…"
          groupAllLabel="All room types"
          emptyLabel="No rooms yet."
          items={rooms.map((r) => {
            const badge = roomStatusBadge(r.status);
            return {
              id: r.id,
              title: `Room ${r.room_number}`,
              subtitle: r.notes,
              meta: r.floor === null ? null : `Floor ${r.floor}`,
              group: typeName.get(r.type_id) ?? "Unassigned",
              badge: { label: badge.label, variant: badge.variant },
              search: `${r.status} ${r.floor ?? ""}`,
              children: (
                <form action={updateRoom} className="space-y-4">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Room number</Label>
                      <Input name="room_number" defaultValue={r.room_number} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select name="type_id" defaultValue={r.type_id}>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Floor</Label>
                      <Input name="floor" type="number" defaultValue={r.floor ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select name="status" defaultValue={r.status}>
                        {ROOM_STATUSES.map((s) => (
                          <option key={s} value={s}>{roomStatusBadge(s).label}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea name="notes" defaultValue={r.notes ?? ""} rows={2} />
                  </div>
                  <FormActions>
                    <SubmitButton size="sm">Save</SubmitButton>
                    <DeleteButton
                      action={deleteRoom}
                      confirmMessage={`Delete room ${r.room_number}? This can't be undone.`}
                      className="ml-auto"
                    />
                  </FormActions>
                </form>
              ),
            };
          })}
        />
      </section>
    </div>
  );
}
