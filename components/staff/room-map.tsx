import Link from "next/link";
import { Building2, Wrench, Sparkles, CalendarClock, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type RoomRow = {
  id: string;
  room_number: string;
  floor: number | null;
  status: string;
  room_types: { name: string; slug: string } | null;
};

export type StayRow = {
  id: string;
  room_id: string;
  guest_name: string;
  status: string;
  check_in: string;
  check_out: string;
};

export type TileState = "occupied" | "due" | "cleaning" | "maintenance" | "available";

const TILE_STYLE: Record<TileState, string> = {
  occupied: "border-transparent bg-danger text-danger-foreground",
  due: "border-transparent bg-warning text-warning-foreground",
  cleaning: "border-dashed border-silver bg-silver/15 text-foreground/60",
  maintenance: "border-transparent bg-onyx-soft text-cream/80",
  available: "border-success/40 bg-success/15 text-success",
};

const TILE_LABEL: Record<TileState, string> = {
  occupied: "Occupied",
  due: "Arriving today",
  cleaning: "Being cleaned",
  maintenance: "Maintenance",
  available: "Free",
};

const TILE_ICON: Record<TileState, React.ComponentType<{ className?: string }> | null> = {
  occupied: User,
  due: CalendarClock,
  cleaning: Sparkles,
  maintenance: Wrench,
  available: null,
};

export function tileState(room: RoomRow, stay: StayRow | undefined): TileState {
  if (stay?.status === "checked_in" || room.status === "occupied") return "occupied";
  if (stay) return "due"; // pending/confirmed stay covering today, guest not checked in yet
  if (room.status === "cleaning") return "cleaning";
  if (room.status === "maintenance") return "maintenance";
  return "available";
}

function RoomTile({ room, stay }: { room: RoomRow; stay: StayRow | undefined }) {
  const state = tileState(room, stay);
  const Icon = TILE_ICON[state];
  const tooltip = [
    `#${room.room_number} · ${room.room_types?.name ?? "No type"}`,
    TILE_LABEL[state],
    stay ? `${stay.guest_name} · ${stay.check_in} → ${stay.check_out}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  const tile = (
    <span
      title={tooltip}
      className={cn(
        "flex h-14 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border font-mono text-sm font-semibold shadow-soft transition-transform",
        TILE_STYLE[state],
        stay && "hover:-translate-y-0.5",
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

  // A tile with a live stay is a shortcut to that booking, bus-seat style.
  return stay ? <Link href={`/booking/${stay.id}`}>{tile}</Link> : tile;
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
}: {
  name: string;
  rooms: RoomRow[];
  stays: Map<string, StayRow>;
}) {
  const floors = [...new Set(rooms.map((r) => r.floor ?? 0))].sort((a, b) => b - a);
  const typeNames = [...new Set(rooms.map((r) => r.room_types?.name).filter(Boolean))];
  const occupied = rooms.filter((r) => tileState(r, stays.get(r.id)) === "occupied").length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/40">
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
      <CardContent className="space-y-3 pt-5">
        {floors.map((floor) => (
          <div key={floor} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-right font-mono text-xs font-semibold text-muted-foreground">
              {floor}F
            </span>
            <div className="flex flex-wrap gap-2 border-l border-dashed border-border/60 pl-3">
              {rooms
                .filter((r) => (r.floor ?? 0) === floor)
                .map((r) => (
                  <RoomTile key={r.id} room={r} stay={stays.get(r.id)} />
                ))}
            </div>
          </div>
        ))}
        <div className="ml-11 border-t-2 border-border/80 pt-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          Ground
        </div>
      </CardContent>
    </Card>
  );
}
