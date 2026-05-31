import { describe, it, expect } from "vitest";
import {
  nightsBetween,
  round2,
  calculateBookingTotal,
} from "@/lib/pricing";

describe("nightsBetween", () => {
  it("counts whole nights between two dates", () => {
    expect(nightsBetween("2026-01-01", "2026-01-03")).toBe(2);
    expect(nightsBetween("2026-06-10", "2026-06-11")).toBe(1);
  });

  it("returns 0 for same-day or reversed ranges", () => {
    expect(nightsBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(nightsBetween("2026-01-05", "2026-01-01")).toBe(0);
  });

  it("returns 0 for unparseable input", () => {
    expect(nightsBetween("not-a-date", "2026-01-03")).toBe(0);
    expect(nightsBetween("2026-01-01", "")).toBe(0);
  });

  it("spans month/year boundaries", () => {
    expect(nightsBetween("2025-12-31", "2026-01-02")).toBe(2);
  });
});

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(10.126)).toBe(10.13);
    expect(round2(10.124)).toBe(10.12);
    expect(round2(5)).toBe(5);
  });
});

describe("calculateBookingTotal", () => {
  it("layers tax and service on top of base × nights", () => {
    const t = calculateBookingTotal({
      basePrice: 100,
      nights: 2,
      taxRate: 0.13,
      serviceRate: 0.1,
    });
    expect(t).toEqual({
      nights: 2,
      subtotal: 200,
      taxAmount: 26,
      serviceAmount: 20,
      total: 246,
    });
  });

  it("handles zero nights as a zero total", () => {
    const t = calculateBookingTotal({
      basePrice: 100,
      nights: 0,
      taxRate: 0.13,
      serviceRate: 0.1,
    });
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
  });

  it("handles zero rates (total == subtotal)", () => {
    const t = calculateBookingTotal({
      basePrice: 150,
      nights: 3,
      taxRate: 0,
      serviceRate: 0,
    });
    expect(t.subtotal).toBe(450);
    expect(t.taxAmount).toBe(0);
    expect(t.serviceAmount).toBe(0);
    expect(t.total).toBe(450);
  });

  it("rounds fractional money to 2 decimals", () => {
    const t = calculateBookingTotal({
      basePrice: 99.99,
      nights: 1,
      taxRate: 0.13,
      serviceRate: 0.1,
    });
    expect(t.subtotal).toBe(99.99);
    expect(t.taxAmount).toBe(13); // round2(99.99 * 0.13 = 12.9987)
    expect(t.serviceAmount).toBe(10); // round2(99.99 * 0.10 = 9.999)
    expect(t.total).toBe(122.99);
  });
});
