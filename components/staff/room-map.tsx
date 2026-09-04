import Link from "next/link";
import { Building2, Wrench, Sparkles, CalendarClock, User, AlarmClock } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomTileMenu } from "@/components/staff/room-tile-menu";
import { cn } from "@/lib/utils";

export type RoomRow = {
  id: string;
  room_number: string;
  floor: number | null;
  status: string;
  room_types: { name: string; slug: string; max_guests: number; base_price: number } | null;
};

export type StayRow = {
  id: string;
  room_id: string;
  booking_code: string;
  guest_name: string;
  guests_count: number;
  status: string;
  check_in: string;
  check_out: string;
};

export type TileState = "occupied" | "overdue" | "due" | "cleaning" | "maintenance" | "available";

const TILE_STYLE: Record<TileState, string> = {
  occupied: "border-transparent bg-danger text-danger-foreground",
  overdue:
    "border-transparent bg-danger text-danger-foreground ring-2 ring-warning ring-offset-1 ring-offset-background",
  due: "border-transparent bg-warning text-warning-foreground",
  cleaning: "border-dashed border-silver bg-silver/15 text-foreground/60",
  maintenance: "border-transparent bg-onyx-soft text-cream/80",
  available: "border-success/40 bg-success/15 text-success",
};

const TILE_LABEL: Record<TileState, string> = {
  occupied: "Occupied",
  overdue: "Overdue checkout",
  due: "Arriving today",
  cleaning: "Being cleaned",
  maintenance: "Maintenance",
  available: "Free",
};

const TILE_ICON: Record<TileState, React.ComponentType<{ className?: string }> | null> = {
  occupied: User,
  overdue: AlarmClock,
  due: CalendarClock,
  cleaning: Sparkles,
  maintenance: Wrench,
  available: null,
};

// The premium wing is one physical building (floors 3-4); every standard
// type lives in the second building (floors 6-9). Assignment is by room
// type, not floor, so a future re-shuffle follows the type automatically.
const BUILDING_A_SLUGS = ["premium-suite", "premium", "deluxe-twin", "deluxe-double"];

export function tileState(room: RoomRow, stay: StayRow | undefined, today: string): TileState {
  if (stay?.status === "checked_in") {
    return stay.check_out < today ? "overdue" : "occupied";
  }
  if (room.status === "occupied") return "occupied";
  if (stay) return "due"; // pending/confirmed stay covering today, guest not checked in yet
  if (room.status === "cleaning") return "cleaning";
  if (room.status === "maintenance") return "maintenance";
  return "available";
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function HoverCard({ room, stay, state }: { room: RoomRow; stay: StayRow | undefined; state: TileState }) {
  return (
    <span
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-60 -translate-x-1/2 flex-col gap-1.5 rounded-md border border-foreground/10 bg-card p-3 text-left shadow-soft-lg group-hover:flex group-focus-within:flex"
      role="tooltip"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">#{room.room_number}</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
          <span className={cn("h-2.5 w-2.5 rounded-full border", TILE_STYLE[state])} />
          {TILE_LABEL[state]}
        </span>
      </span>
      <span className="text-sm font-medium text-foreground">{room.room_types?.name ?? "No type"}</span>
      {room.room_types && (
        <span className="text-xs text-muted-foreground">
          Sleeps {room.room_types.max_guests} · Rs {Number(room.room_types.base_price).toLocaleString("en-IN")} / night
        </span>
      )}
      {stay ? (
        <span className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-1.5">
          <span className="text-sm font-medium text-foreground">{stay.guest_name}</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono">{stay.booking_code}</span> · {stay.guests_count}{" "}
            {stay.guests_count === 1 ? "guest" : "guests"}
          </span>
          <span className={cn("text-xs", state === "overdue" ? "font-medium text-danger" : "text-muted-foreground")}>
            {shortDate(stay.check_in)} → {shortDate(stay.check_out)}
            {state === "overdue"
              ? " · past check-out, not checked out"
              : stay.status === "checked_in"
                ? " · in house"
                : " · due today"}
          </span>
          <span className="text-xs font-medium text-accent-foreground/70">Click to open booking</span>
        </span>
      ) : (
        <span className="mt-1 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
          No booking today
        </span>
      )}
    </span>
  );
}

function RoomTile({ room, stay, today }: { room: RoomRow; stay: StayRow | undefined; today: string }) {
  const state = tileState(room, stay, today);
  const Icon = TILE_ICON[state];

  const tile = (
    <span
      className={cn(
        "flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg border font-mono text-sm font-semibold shadow-soft transition-all duration-150",
        TILE_STYLE[state],
        stay && "cursor-pointer hover:-translate-y-0.5 hover:shadow-soft-lg",
      )}
    >
      {room.room_number}
      {Icon ? <Icon className="h-3.5 w-3.5 opacity-80" /> : <span className="h-3.5" />}
      <span className="sr-only">
        {room.room_types?.name ?? "No type"}, {TILE_LABEL[state]}
        {stay ? `, ${stay.guest_name}` : ""}
      </span>
    </span>
  );

  // A tile with a live stay is a shortcut to that booking's back-office detail
  // (check in / out, extend, mark ready — all inline), bus-seat style.
  if (stay) {
    return (
      <span className="group relative block">
        <Link href={`/dashboard/bookings/${stay.id}`} className="block">
          {tile}
        </Link>
        <HoverCard room={room} stay={stay} state={state} />
      </span>
    );
  }

  // No guest today: free / cleaning / maintenance rooms get a click-to-open
  // action menu (mark ready, send to cleaning, set maintenance) right here, so
  // any room action is reachable from the map. Occupied without a stay row
  // (rare/stale) is left non-actionable.
  if (state === "cleaning" || state === "maintenance" || state === "available") {
    const price = room.room_types
      ? `Sleeps ${room.room_types.max_guests} · Rs ${Number(room.room_types.base_price).toLocaleString("en-IN")} / night`
      : null;
    return (
      <RoomTileMenu
        roomId={room.id}
        state={state}
        info={{
          roomNumber: room.room_number,
          stateLabel: TILE_LABEL[state],
          typeName: room.room_types?.name ?? "No type",
          priceText: price,
        }}
      >
        {tile}
      </RoomTileMenu>
    );
  }

  return (
    <span className="group relative block">
      {tile}
      <HoverCard room={room} stay={stay} state={state} />
    </span>
  );
}

export function RoomMapLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {(Object.keys(TILE_STYLE) as TileState[]).map((state) => (
        <span key={state} className="flex items-center gap-2">
          <span className={cn("h-4 w-5 rounded border", TILE_STYLE[state])} />
          <span className="text-muted-foreground">{TILE_LABEL[state]}</span>
        </span>
      ))}
    </div>
  );
}

export function BuildingCard({
  name,
  rooms,
  stays,
  today,
}: {
  name: string;
  rooms: RoomRow[];
  stays: Map<string, StayRow>;
  today: string;
}) {
  const typeNames = [...new Set(rooms.map((r) => r.room_types?.name).filter(Boolean))];
  const occupied = rooms.filter((r) => {
    const state = tileState(r, stays.get(r.id), today);
    return state === "occupied" || state === "overdue";
  }).length;

  return (
    <Card>
      <CardHeader className="rounded-t-[4px] border-b border-border/60 bg-muted/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-display">
            <Building2 className="h-5 w-5 text-accent" />
            {name}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            <span className={cn("font-semibold", occupied > 0 ? "text-danger" : "text-success")}>
              {occupied}
            </span>{" "}
            / {rooms.length} occupied
          </span>
        </div>
        <CardDescription>{typeNames.join(" · ")}</CardDescription>
      </CardHeader>
      {/* One responsive grid per building: tiles auto-fill and re-flow to fit
          whatever width the card has (no fixed floor rows — the room number's
          leading digit isn't a real floor here). */}
      <CardContent className="pt-5">
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(3.25rem,1fr))]">
          {rooms.map((r) => (
            <RoomTile key={r.id} room={r} stay={stays.get(r.id)} today={today} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Self-contained live room map: fetches rooms + today's stays and renders
 *  both buildings. Dropped into the dashboard overview as a section. */
export async function RoomMapSection() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [roomsRes, checkedInRes, arrivalsRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, room_number, floor, status, room_types:type_id(name, slug, max_guests, base_price)")
      .order("room_number"),
    // Guests physically in a room right now — no date filter, so an overdue
    // checkout still shows as occupying its room.
    supabase
      .from("bookings")
      .select("id, room_id, booking_code, guest_name, guests_count, status, check_in, check_out")
      .eq("status", "checked_in"),
    // Not-yet-arrived bookings whose stay covers today.
    supabase
      .from("bookings")
      .select("id, room_id, booking_code, guest_name, guests_count, status, check_in, check_out")
      .in("status", ["pending", "confirmed"])
      .lte("check_in", today)
      .gt("check_out", today),
  ]);

  const rooms = (roomsRes.data as unknown as RoomRow[] | null) ?? [];
  const bookings = [
    ...((checkedInRes.data as unknown as StayRow[] | null) ?? []),
    ...((arrivalsRes.data as unknown as StayRow[] | null) ?? []),
  ];

  // One stay per room; a checked-in guest beats a same-day arrival.
  const stays = new Map<string, StayRow>();
  for (const b of bookings) {
    const current = stays.get(b.room_id);
    if (!current || b.status === "checked_in") stays.set(b.room_id, b);
  }

  const buildingA = rooms.filter((r) => BUILDING_A_SLUGS.includes(r.room_types?.slug ?? ""));
  const buildingB = rooms.filter((r) => !BUILDING_A_SLUGS.includes(r.room_types?.slug ?? ""));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Room map</h2>
        <RoomMapLegend />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <BuildingCard name="Building A" rooms={buildingA} stays={stays} today={today} />
        <BuildingCard name="Building B" rooms={buildingB} stays={stays} today={today} />
      </div>
    </section>
  );
}
