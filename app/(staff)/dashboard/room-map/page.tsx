import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import {
  BuildingCard,
  RoomMapLegend,
  type RoomRow,
  type StayRow,
} from "@/components/staff/room-map";

export const dynamic = "force-dynamic";

// The premium wing is one physical building (floors 3-4); every standard
// type lives in the second building (floors 6-9). Assignment is by room
// type, not floor, so a future re-shuffle follows the type automatically.
const BUILDING_A_SLUGS = ["premium-suite", "premium", "deluxe-twin", "deluxe-double"];

export default async function RoomMapPage() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [roomsRes, checkedInRes, arrivalsRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, room_number, floor, status, room_types:type_id(name, slug)")
      .order("room_number"),
    // Guests physically in a room right now — no date filter, so an overdue
    // checkout still shows as occupying its room.
    supabase
      .from("bookings")
      .select("id, room_id, guest_name, status, check_in, check_out")
      .eq("status", "checked_in"),
    // Not-yet-arrived bookings whose stay covers today.
    supabase
      .from("bookings")
      .select("id, room_id, guest_name, status, check_in, check_out")
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
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Live overview"
        title="Room map"
        description="Every room at a glance, floor by floor. Tap a coloured room to open its booking."
      />
      <RoomMapLegend />
      <div className="grid gap-6 lg:grid-cols-2">
        <BuildingCard name="Building A" rooms={buildingA} stays={stays} />
        <BuildingCard name="Building B" rooms={buildingB} stays={stays} />
      </div>
    </div>
  );
}
