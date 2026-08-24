import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const BLOCKING_STATUSES = ["pending", "confirmed", "checked_in"] as const;

/**
 * Returns the id of an available room of the given type for the requested
 * range, or null if none. Date overlap test:
 *   booking.check_in <  requested.check_out  AND
 *   booking.check_out > requested.check_in
 * The DB also enforces an exclusion constraint (see 0005), so the final
 * booking insert is safe even if two callers race past this check.
 */
export async function findAvailableRoom(
  supabase: Client,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Promise<string | null> {
  const found = await findAvailableRooms(supabase, roomTypeId, checkIn, checkOut, 1);
  return found[0] ?? null;
}

/**
 * Returns up to `count` distinct available room ids of the given type for the
 * requested range (fewer if the type doesn't have that many free). Used by the
 * group-booking flow to reserve several rooms of one type in a single intent.
 */
export async function findAvailableRooms(
  supabase: Client,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  count: number,
): Promise<string[]> {
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("type_id", roomTypeId)
    .neq("status", "maintenance");
  const all = (rooms as { id: string }[] | null) ?? [];
  if (all.length === 0) return [];

  const ids = all.map((r) => r.id);
  const { data: blocked } = await supabase
    .from("bookings")
    .select("room_id")
    .in("room_id", ids)
    .in("status", [...BLOCKING_STATUSES])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);
  const blockedIds = new Set(
    ((blocked as { room_id: string }[] | null) ?? []).map((b) => b.room_id),
  );
  return all
    .filter((r) => !blockedIds.has(r.id))
    .slice(0, count)
    .map((r) => r.id);
}

/**
 * Counts how many rooms of the given type are bookable for the requested
 * range. Same overlap test as `findAvailableRoom` but returns a count so the
 * listing page can show "3 left" / "Sold out" badges without iterating per
 * room. Excludes maintenance rooms from the denominator.
 */
export async function countAvailableRooms(
  supabase: Client,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Promise<number> {
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("type_id", roomTypeId)
    .neq("status", "maintenance");
  const all = (rooms as { id: string }[] | null) ?? [];
  if (all.length === 0) return 0;

  const ids = all.map((r) => r.id);
  const { data: blocked } = await supabase
    .from("bookings")
    .select("room_id")
    .in("room_id", ids)
    .in("status", [...BLOCKING_STATUSES])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);
  const blockedIds = new Set(
    ((blocked as { room_id: string }[] | null) ?? []).map((b) => b.room_id),
  );
  return all.filter((r) => !blockedIds.has(r.id)).length;
}

export async function isStillAvailable(
  supabase: Client,
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("bookings")
    .select("id")
    .eq("room_id", roomId)
    .in("status", [...BLOCKING_STATUSES])
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .limit(1);
  return ((data as unknown[] | null) ?? []).length === 0;
}
