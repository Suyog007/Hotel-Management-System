"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RoomTypeOpt = {
  id: string;
  name: string;
  base_price: number;
  max_guests: number;
};

type AvailRoom = { id: string; room_number: string };

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/**
 * The date + room-type + room-number block of the walk-in form. Owns these
 * fields client-side so that picking a type (or changing the dates) can fetch
 * the specific rooms of that type that are free for the range and offer them
 * in a second dropdown. "Any available room" (value "") keeps the original
 * auto-assign behaviour; the action falls back to auto-assign if the chosen
 * room was taken in the meantime. The remaining walk-in fields stay in the
 * surrounding server-rendered <form>.
 */
export function WalkInRoomPicker({
  types,
  today,
  tomorrow,
}: {
  types: RoomTypeOpt[];
  today: string;
  tomorrow: string;
}) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [rooms, setRooms] = useState<AvailRoom[]>([]);
  const [roomId, setRoomId] = useState(""); // "" = any available
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!typeId || !checkIn || !checkOut || checkOut <= checkIn) {
      setRooms([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ type_id: typeId, check_in: checkIn, check_out: checkOut });
    fetch(`/api/dashboard/available-rooms?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((data: { rooms?: AvailRoom[] }) => {
        if (id !== reqId.current) return; // a newer request superseded this one
        const list = data.rooms ?? [];
        setRooms(list);
        // Drop the selection if it's no longer offered for the new type/dates.
        setRoomId((cur) => (list.some((x) => x.id === cur) ? cur : ""));
      })
      .catch(() => {
        if (id === reqId.current) setRooms([]);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [typeId, checkIn, checkOut]);

  const noneFree = !loading && rooms.length === 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Check-in</Label>
          <Input
            name="check_in"
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Check-out</Label>
          <Input
            name="check_out"
            type="date"
            min={checkIn > today ? checkIn : tomorrow}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Guests</Label>
          <Input name="guests_count" type="number" min={1} max={20} defaultValue={1} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Room type</Label>
          <select
            name="room_type_id"
            required
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className={SELECT_CLASS}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.base_price} / night, sleeps {t.max_guests})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Room number
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </Label>
          <select
            name="room_id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={loading || noneFree}
            className={SELECT_CLASS}
          >
            <option value="">
              {noneFree ? "No rooms free for these dates" : `Any available room${rooms.length ? ` (${rooms.length} free)` : ""}`}
            </option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.room_number}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Leave on &ldquo;Any available room&rdquo; to auto-assign, or pick a specific room.
          </p>
        </div>
      </div>
    </>
  );
}
