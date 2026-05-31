import { describe, it, expect } from "vitest";
import {
  findAvailableRoom,
  countAvailableRooms,
  isStillAvailable,
} from "@/lib/availability";

/**
 * Minimal chainable Supabase stub. Every query method returns the same builder
 * (so .select().eq().in()... chains work) and the builder is awaitable,
 * resolving to { data, error } seeded per table. Filters are intentionally
 * ignored — we drive behaviour by seeding `rooms` / `bookings` directly, which
 * is exactly the JS branching the functions own (the DB enforces the real
 * overlap constraint separately).
 */
function makeClient(data: Record<string, unknown[]>) {
  const builderFor = (table: string) => {
    const result = { data: data[table] ?? [], error: null };
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    for (const m of ["select", "eq", "neq", "in", "lt", "gt", "limit", "order"]) {
      builder[m] = self;
    }
    (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      resolve(result);
    return builder;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (table: string) => builderFor(table) } as any;
}

const IN = "2026-07-01";
const OUT = "2026-07-04";

describe("findAvailableRoom", () => {
  it("returns the first room not blocked by an overlapping booking", async () => {
    const client = makeClient({
      rooms: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      bookings: [{ room_id: "r1" }],
    });
    expect(await findAvailableRoom(client, "type-1", IN, OUT)).toBe("r2");
  });

  it("returns null when every room is blocked", async () => {
    const client = makeClient({
      rooms: [{ id: "r1" }, { id: "r2" }],
      bookings: [{ room_id: "r1" }, { room_id: "r2" }],
    });
    expect(await findAvailableRoom(client, "type-1", IN, OUT)).toBeNull();
  });

  it("returns null when the room type has no rooms", async () => {
    const client = makeClient({ rooms: [], bookings: [] });
    expect(await findAvailableRoom(client, "type-1", IN, OUT)).toBeNull();
  });

  it("returns a room when there are no overlapping bookings", async () => {
    const client = makeClient({
      rooms: [{ id: "r1" }, { id: "r2" }],
      bookings: [],
    });
    expect(await findAvailableRoom(client, "type-1", IN, OUT)).toBe("r1");
  });
});

describe("countAvailableRooms", () => {
  it("counts rooms not blocked by an overlapping booking", async () => {
    const client = makeClient({
      rooms: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      bookings: [{ room_id: "r2" }],
    });
    expect(await countAvailableRooms(client, "type-1", IN, OUT)).toBe(2);
  });

  it("returns 0 when there are no rooms", async () => {
    const client = makeClient({ rooms: [], bookings: [] });
    expect(await countAvailableRooms(client, "type-1", IN, OUT)).toBe(0);
  });

  it("returns the full count when nothing is booked", async () => {
    const client = makeClient({
      rooms: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      bookings: [],
    });
    expect(await countAvailableRooms(client, "type-1", IN, OUT)).toBe(3);
  });
});

describe("isStillAvailable", () => {
  it("is true when no overlapping booking exists", async () => {
    const client = makeClient({ bookings: [] });
    expect(await isStillAvailable(client, "r1", IN, OUT)).toBe(true);
  });

  it("is false when an overlapping booking exists", async () => {
    const client = makeClient({ bookings: [{ id: "b1" }] });
    expect(await isStillAvailable(client, "r1", IN, OUT)).toBe(false);
  });
});
