import { describe, it, expect } from "vitest";
import { sortBySuitability } from "@/lib/room-suitability";

const R = (name: string, max_guests: number, base_price: number) => ({
  name,
  max_guests,
  base_price,
});

describe("sortBySuitability", () => {
  it("a solo guest sees the smallest rooms first, suite last", () => {
    const rooms = [
      R("Premium Suite", 6, 3999),
      R("Premium Double", 5, 3499),
      R("Deluxe Twin", 4, 3199),
      R("Standard Double Non-AC", 2, 1200),
      R("Standard Twin", 3, 2199),
    ];
    const out = sortBySuitability(rooms, 1).map((r) => r.name);
    expect(out).toEqual([
      "Standard Double Non-AC", // sleeps 2
      "Standard Twin", // sleeps 3
      "Deluxe Twin", // sleeps 4
      "Premium Double", // sleeps 5
      "Premium Suite", // sleeps 6
    ]);
  });

  it("puts rooms that fit the party ahead of ones too small", () => {
    const rooms = [R("Twin", 2, 1000), R("Family", 4, 2000), R("Single", 1, 800)];
    // party of 3: Family (fits) first; Twin and Single are too small, after.
    const out = sortBySuitability(rooms, 3).map((r) => r.name);
    expect(out[0]).toBe("Family");
    expect(out.slice(1)).toEqual(["Single", "Twin"]); // too-small, tightest first
  });

  it("breaks capacity ties by cheapest nightly price", () => {
    const rooms = [
      R("Deluxe Twin", 4, 3199),
      R("Standard Twin Family", 4, 2499),
    ];
    const out = sortBySuitability(rooms, 2).map((r) => r.name);
    expect(out).toEqual(["Standard Twin Family", "Deluxe Twin"]);
  });

  it("does not mutate the input array", () => {
    const rooms = [R("B", 4, 2000), R("A", 2, 1000)];
    const copy = [...rooms];
    sortBySuitability(rooms, 1);
    expect(rooms).toEqual(copy);
  });
});
