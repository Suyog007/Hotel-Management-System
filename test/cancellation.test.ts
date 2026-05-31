import { describe, it, expect } from "vitest";
import { computeRefund, type CancellationTier } from "@/lib/cancellation";

const TIERS: CancellationTier[] = [
  { hours_before_checkin: 72, refund_percentage: 100, label: ">=72h" },
  { hours_before_checkin: 24, refund_percentage: 50, label: "24-72h" },
  { hours_before_checkin: 0, refund_percentage: 0, label: "<24h" },
];

const NOW = new Date("2026-06-01T00:00:00Z");

describe("computeRefund", () => {
  it("gives a full refund well before check-in (>72h)", () => {
    const r = computeRefund({
      paidAmount: 1000,
      checkIn: "2026-06-10", // 9 days out
      now: NOW,
      tiers: TIERS,
    });
    expect(r.tier?.refund_percentage).toBe(100);
    expect(r.refundAmount).toBe(1000);
  });

  it("gives a half refund in the 24-72h window", () => {
    const r = computeRefund({
      paidAmount: 1000,
      checkIn: "2026-06-03", // exactly 48h out
      now: NOW,
      tiers: TIERS,
    });
    expect(r.tier?.refund_percentage).toBe(50);
    expect(r.refundAmount).toBe(500);
  });

  it("gives nothing inside 24h", () => {
    const r = computeRefund({
      paidAmount: 1000,
      checkIn: "2026-06-02", // 12h out
      now: new Date("2026-06-01T12:00:00Z"),
      tiers: TIERS,
    });
    expect(r.tier?.refund_percentage).toBe(0);
    expect(r.refundAmount).toBe(0);
  });

  it("treats the threshold as inclusive (exactly 72h -> full)", () => {
    const r = computeRefund({
      paidAmount: 1000,
      checkIn: "2026-06-04", // exactly 72h out
      now: NOW,
      tiers: TIERS,
    });
    expect(r.tier?.refund_percentage).toBe(100);
  });

  it("clamps past-due check-ins to 0 hours and the lowest tier", () => {
    const r = computeRefund({
      paidAmount: 1000,
      checkIn: "2026-05-20", // already passed
      now: NOW,
      tiers: TIERS,
    });
    expect(r.hoursUntilCheckIn).toBe(0);
    expect(r.tier?.refund_percentage).toBe(0);
    expect(r.refundAmount).toBe(0);
  });

  it("returns a null tier and 0 refund when no tiers configured", () => {
    const r = computeRefund({
      paidAmount: 1000,
      checkIn: "2026-06-10",
      now: NOW,
      tiers: [],
    });
    expect(r.tier).toBeNull();
    expect(r.refundAmount).toBe(0);
  });

  it("does not mutate the caller's tier array", () => {
    const tiers = [...TIERS];
    const snapshot = JSON.stringify(tiers);
    computeRefund({ paidAmount: 100, checkIn: "2026-06-10", now: NOW, tiers });
    expect(JSON.stringify(tiers)).toBe(snapshot);
  });

  it("applies the tier percentage to the paid amount", () => {
    const r = computeRefund({
      paidAmount: 200.5,
      checkIn: "2026-06-03",
      now: NOW,
      tiers: TIERS,
    });
    expect(r.refundAmount).toBe(100.25); // 200.50 * 50%
  });
});
