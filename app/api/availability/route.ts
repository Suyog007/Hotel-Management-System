import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = ["pending", "confirmed", "checked_in"];
const HORIZON_DAYS = 180;

function ymd(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

/**
 * GET /api/availability?room_type_id=<uuid>[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
 *
 * Returns the set of dates within [from, to] where every room of that type
 * is already booked (i.e. no rooms left to assign).
 *
 * - "Booked on day D" = check_in <= D < check_out, status active.
 * - If concurrent bookings >= total rooms of the type, day D is blocked.
 *
 * Public read OK: this leaks zero PII (only counts). Cached briefly so
 * a single picker open doesn't hammer the DB.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomTypeId = url.searchParams.get("room_type_id");
  if (!roomTypeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomTypeId)) {
    return NextResponse.json({ error: "missing or invalid room_type_id" }, { status: 400 });
  }

  const today = ymd(new Date());
  const from = url.searchParams.get("from") ?? today;
  const to = url.searchParams.get("to") ?? addDays(today, HORIZON_DAYS);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "invalid date format" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Room inventory for this type.
  const { count: totalRooms } = await admin
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("type_id", roomTypeId);

  if (!totalRooms) {
    // No rooms exist for this type → every day blocked.
    const blocked: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) blocked.push(d);
    return NextResponse.json(
      { blockedDates: blocked, totalRooms: 0 },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }

  // 2. Active bookings for any room of this type, overlapping [from, to].
  //    Stay [check_in, check_out) overlaps [from, to] iff
  //    check_in <= to AND check_out > from.
  const { data: bookings } = await admin
    .from("bookings")
    .select("check_in, check_out, room_id, rooms:room_id(type_id)")
    .in("status", ACTIVE_STATUSES)
    .lte("check_in", to)
    .gt("check_out", from);

  const rows =
    (bookings as Array<{
      check_in: string;
      check_out: string;
      rooms: { type_id: string } | null;
    }> | null) ?? [];

  const matching = rows.filter((r) => r.rooms?.type_id === roomTypeId);

  // 3. For each day in [from, to], count overlapping bookings.
  const blocked: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    let count = 0;
    for (const b of matching) {
      if (b.check_in <= d && b.check_out > d) count++;
    }
    if (count >= totalRooms) blocked.push(d);
  }

  return NextResponse.json(
    { blockedDates: blocked, totalRooms, from, to },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
