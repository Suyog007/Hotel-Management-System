import { redirect } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageListField } from "@/components/ui/image-list-field";
import { AmenityPicker, COMMON_ROOM_AMENITIES } from "@/components/ui/amenity-picker";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
import { Badge, roomStatusBadge } from "@/components/ui/badge";
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

  // Physical rooms hang off their type instead of living in a second list, so
  // "Premium Suite" appears once on the page rather than twice.
  const roomsByType = new Map<string, RoomRow[]>();
  for (const r of rooms) {
    const list = roomsByType.get(r.type_id);
    if (list) list.push(r);
    else roomsByType.set(r.type_id, [r]);
  }

  const typeIds = new Set(types.map((t) => t.id));
  const orphans = rooms.filter((r) => !typeIds.has(r.type_id));

  // Tick-list options: the usual suspects, plus whatever the existing types
  // already use. Sourcing from the data is what stops a second spelling of an
  // amenity ("AC" next to "Air conditioning") from creeping onto the site.
  const knownAmenities = [...COMMON_ROOM_AMENITIES.map((a) => a.toLowerCase())];
  const amenityOptions = [
    ...COMMON_ROOM_AMENITIES,
    ...[...new Set(types.flatMap((t) => t.amenities ?? []))].filter(
      (a) => !knownAmenities.includes(a.toLowerCase()),
    ),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Rooms"
        description="One entry per room type. Open a type to set its price and photos, and to manage the physical rooms guests are checked into."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <StatusSummary rooms={rooms} />

      <CreatePanel title="New room type" description="e.g. Deluxe, Premium Suite">
        <form action={createRoomType} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nt_name">Name</Label>
              <Input id="nt_name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt_base_price">Price per night</Label>
              <Input id="nt_base_price" name="base_price" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt_max_guests">Max guests</Label>
              <Input id="nt_max_guests" name="max_guests" type="number" min="1" max="20" defaultValue="2" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt_slug">Web address (auto if blank)</Label>
              <Input id="nt_slug" name="slug" placeholder="deluxe" />
            </div>
          </div>

          <ImageListField name="images" fileName="image_files" label="Photos" />

          <MoreDetails>
            <div className="space-y-2">
              <Label htmlFor="nt_description">Description</Label>
              <Textarea id="nt_description" name="description" />
            </div>
            <AmenityPicker name="amenities" options={amenityOptions} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nt_original_price">Was-price (optional)</Label>
                <Input id="nt_original_price" name="original_price" type="number" min="0" step="0.01" />
                <p className="text-xs text-muted-foreground">
                  Shown struck through next to the price. Blank if no offer is running.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt_sort_order">Sort order</Label>
                <Input id="nt_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
              </div>
            </div>
          </MoreDetails>

          <div className="flex items-center gap-3">
            <Switch id="nt_is_active" name="is_active" defaultChecked />
            <Label htmlFor="nt_is_active">Bookable on the website</Label>
          </div>

          <FormActions>
            <SubmitButton size="sm">Add room type</SubmitButton>
          </FormActions>
        </form>
      </CreatePanel>

      <ManageList
        storageKey="room-types"
        noun="room types"
        searchPlaceholder="Search room types and room numbers…"
        emptyLabel="No room types yet — add one above to get started."
        items={types.map((t) => {
          const mine = roomsByType.get(t.id) ?? [];
          return {
            id: t.id,
            title: t.name,
            subtitle: `Sleeps ${t.max_guests} · ${mine.length} room${mine.length === 1 ? "" : "s"}${
              mine.length ? `: ${mine.map((r) => r.room_number).join(", ")}` : ""
            }`,
            meta: String(t.base_price),
            badge: t.is_active ? null : { label: "Not bookable", variant: "outline" as const },
            thumbnail: t.images?.[0] ?? null,
            search: `${t.description ?? ""} ${t.slug} ${mine.map((r) => r.room_number).join(" ")}`,
            children: (
              <div className="space-y-6">
                <form action={updateRoomType} className="space-y-4">
                  <input type="hidden" name="id" value={t.id} />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input name="name" defaultValue={t.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Price per night</Label>
                      <Input name="base_price" type="number" min="0" step="0.01" defaultValue={String(t.base_price)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Max guests</Label>
                      <Input name="max_guests" type="number" min="1" max="20" defaultValue={t.max_guests} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Web address</Label>
                      <Input name="slug" defaultValue={t.slug} />
                    </div>
                  </div>

                  <ImageListField
                    name="images"
                    fileName="image_files"
                    label="Photos"
                    value={t.images ?? []}
                  />

                  <MoreDetails>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea name="description" defaultValue={t.description ?? ""} />
                    </div>
                    <AmenityPicker
                      name="amenities"
                      options={amenityOptions}
                      value={t.amenities ?? []}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Was-price (optional)</Label>
                        <Input
                          name="original_price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={t.original_price === null ? "" : String(t.original_price)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Struck through on the site. Blank = no offer.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Sort order</Label>
                        <Input name="sort_order" type="number" min="0" defaultValue={t.sort_order} />
                      </div>
                    </div>
                  </MoreDetails>

                  <div className="flex items-center gap-3">
                    <Switch name="is_active" defaultChecked={t.is_active} />
                    <Label>Bookable on the website</Label>
                  </div>

                  <FormActions>
                    <SubmitButton size="sm">Save room type</SubmitButton>
                    <DeleteButton
                      action={deleteRoomType}
                      confirmMessage={
                        mine.length
                          ? `Delete the “${t.name}” type? Its ${mine.length} room(s) will be left without a type.`
                          : `Delete the “${t.name}” room type?`
                      }
                      className="ml-auto"
                    >
                      Delete type
                    </DeleteButton>
                  </FormActions>
                </form>

                <RoomsPanel type={t} rooms={mine} types={types} />
              </div>
            ),
          };
        })}
      />

      {orphans.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-destructive">
            Rooms with no type ({orphans.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Left behind when a room type was deleted. Reassign each to a type, or delete it.
          </p>
          <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-destructive/30 bg-card">
            {orphans.map((r) => (
              <div key={r.id} className="p-3">
                <RoomForm room={r} types={types} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** The fields you set once and rarely touch, folded away so the form opens short. */
function MoreDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-border/60 bg-muted/20">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show description, amenities &amp; offer price</span>
        <span className="hidden group-open:inline">Hide description, amenities &amp; offer price</span>
      </summary>
      <div className="space-y-4 border-t border-border/60 p-3">{children}</div>
    </details>
  );
}

/** Cross-type "what state is my inventory in" line, since rooms no longer have their own list. */
function StatusSummary({ rooms }: { rooms: RoomRow[] }) {
  if (rooms.length === 0) return null;
  const counts = ROOM_STATUSES.map((status) => ({
    status,
    n: rooms.filter((r) => r.status === status).length,
  })).filter((c) => c.n > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2">
      <span className="text-sm font-medium">
        {rooms.length} room{rooms.length === 1 ? "" : "s"} in total
      </span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      {counts.map(({ status, n }) => {
        const b = roomStatusBadge(status);
        return (
          <Badge key={status} variant={b.variant}>
            {n} {b.label.toLowerCase()}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * The physical rooms belonging to one type, rendered inside that type's row.
 *
 * Each room is its own <form>, a sibling of the type's form and never nested —
 * nested <form> elements are invalid HTML and the inner one silently won't submit.
 */
function RoomsPanel({
  type,
  rooms,
  types,
}: {
  type: RoomTypeRow;
  rooms: RoomRow[];
  types: RoomTypeRow[];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border/60 bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <h4 className="text-sm font-semibold">Rooms of this type</h4>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rooms.length} room{rooms.length === 1 ? "" : "s"}
        </span>
      </header>

      {rooms.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          No physical rooms yet. Add the room numbers guests will actually stay in.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {rooms.map((r) => {
            const b = roomStatusBadge(r.status);
            return (
              <details key={r.id} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  />
                  <span className="text-sm font-medium">Room {r.room_number}</span>
                  {r.floor !== null && (
                    <span className="text-xs text-muted-foreground">Floor {r.floor}</span>
                  )}
                  <Badge variant={b.variant} className="ml-auto shrink-0">
                    {b.label}
                  </Badge>
                </summary>
                <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
                  <RoomForm room={r} types={types} />
                </div>
              </details>
            );
          })}
        </div>
      )}

      <div className="border-t border-border/60 p-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Plus aria-hidden className="h-4 w-4 transition-transform group-open:rotate-45" />
            Add a room to {type.name}
          </summary>
          <form action={createRoom} className="mt-3 space-y-3">
            {/* The type is implied by where this form lives — no dropdown to get wrong. */}
            <input type="hidden" name="type_id" value={type.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`nr_number_${type.id}`}>Room number</Label>
                <Input id={`nr_number_${type.id}`} name="room_number" required placeholder="601" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`nr_floor_${type.id}`}>Floor</Label>
                <Input id={`nr_floor_${type.id}`} name="floor" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`nr_status_${type.id}`}>Status</Label>
                <Select id={`nr_status_${type.id}`} name="status" defaultValue="available">
                  {ROOM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {roomStatusBadge(s).label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`nr_notes_${type.id}`}>Notes (optional)</Label>
              <Textarea
                id={`nr_notes_${type.id}`}
                name="notes"
                rows={2}
                placeholder="Corner room, garden view…"
              />
            </div>
            <FormActions>
              <SubmitButton size="sm">Add room</SubmitButton>
            </FormActions>
          </form>
        </details>
      </div>
    </section>
  );
}

function RoomForm({ room, types }: { room: RoomRow; types: RoomTypeRow[] }) {
  return (
    <form action={updateRoom} className="space-y-3">
      <input type="hidden" name="id" value={room.id} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Room number</Label>
          <Input name="room_number" defaultValue={room.room_number} required />
        </div>
        <div className="space-y-2">
          <Label>Floor</Label>
          <Input name="floor" type="number" defaultValue={room.floor ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select name="status" defaultValue={room.status}>
            {ROOM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {roomStatusBadge(s).label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select name="type_id" defaultValue={room.type_id}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={room.notes ?? ""} rows={2} />
      </div>
      <FormActions>
        <SubmitButton size="sm">Save room</SubmitButton>
        <DeleteButton
          action={deleteRoom}
          confirmMessage={`Delete room ${room.room_number}? This can't be undone.`}
          className="ml-auto"
        />
      </FormActions>
    </form>
  );
}
