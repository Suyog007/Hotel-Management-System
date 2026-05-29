import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<unknown>;

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
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("type_id", roomTypeId)
    .neq("status", "maintenance");
  const all = (rooms as { id: string }[] | null) ?? [];
  if (all.length === 0) return null;

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
  const free = all.find((r) => !blockedIds.has(r.id));
  return free?.id ?? null;
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
