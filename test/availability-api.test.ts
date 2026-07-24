import { describe, it, expect, vi } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";

const h = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));

import { GET } from "@/app/api/availability/route";

const ROOM_TYPE = "11111111-1111-1111-1111-111111111111";

function req(qs: string) {
  return new Request(`http://localhost:4000/api/availability?${qs}`);
}

function setup(rooms: number, bookings: Array<{ check_in: string; check_out: string; room_id: string }>) {
  const roomRows = Array.from({ length: rooms }, (_, i) => ({ id: `room-${i}`, type_id: ROOM_TYPE }));
  const bookingRows = bookings.map((b) => ({
    status: "confirmed",
    ...b,
    rooms: { type_id: ROOM_TYPE },
  }));
  h.admin = createFakeSupabase({ rooms: roomRows, bookings: bookingRows });
}

describe("GET /api/availability", () => {
  it("rejects a missing room_type_id", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });

  it("rejects a non-uuid room_type_id", async () => {
    const res = await GET(req("room_type_id=not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed date", async () => {
    setup(2, []);
    const res = await GET(req(`room_type_id=${ROOM_TYPE}&from=07-20-2026&to=2026-07-25`));
    expect(res.status).toBe(400);
  });

  it("blocks every day in range when the room type has zero rooms", async () => {
    setup(0, []);
    const res = await GET(req(`room_type_id=${ROOM_TYPE}&from=2026-07-20&to=2026-07-22`));
    const body = await res.json();
    expect(body.totalRooms).toBe(0);
    expect(body.blockedDates).toEqual(["2026-07-20", "2026-07-21", "2026-07-22"]);
  });

  it("blocks a day only when bookings meet or exceed room count", async () => {
    setup(1, [{ room_id: "room-0", check_in: "2026-07-20", check_out: "2026-07-22" }]);
    const res = await GET(req(`room_type_id=${ROOM_TYPE}&from=2026-07-19&to=2026-07-23`));
    const body = await res.json();
    expect(body.blockedDates).toEqual(["2026-07-20", "2026-07-21"]);
  });

  it("does not block a day when at least one room is free", async () => {
    setup(2, [{ room_id: "room-0", check_in: "2026-07-20", check_out: "2026-07-22" }]);
    const res = await GET(req(`room_type_id=${ROOM_TYPE}&from=2026-07-20&to=2026-07-21`));
    const body = await res.json();
    expect(body.blockedDates).toEqual([]);
  });

  it("ignores bookings for a different room type", async () => {
    const otherType = "22222222-2222-2222-2222-222222222222";
    h.admin = createFakeSupabase({
      rooms: [{ id: "room-0", type_id: ROOM_TYPE }],
      bookings: [
        {
          status: "confirmed",
          room_id: "other-room",
          check_in: "2026-07-20",
          check_out: "2026-07-22",
          rooms: { type_id: otherType },
        },
      ],
    });
    const res = await GET(req(`room_type_id=${ROOM_TYPE}&from=2026-07-20&to=2026-07-21`));
    const body = await res.json();
    expect(body.blockedDates).toEqual([]);
  });

  it("defaults to today .. +180 days when from/to are omitted", async () => {
    setup(1, []);
    const res = await GET(req(`room_type_id=${ROOM_TYPE}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.blockedDates)).toBe(true);
  });
});
