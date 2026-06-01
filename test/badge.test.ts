import { describe, it, expect } from "vitest";
import {
  bookingStatusBadge,
  paymentStatusBadge,
  roomStatusBadge,
  requestStatusBadge,
} from "@/components/ui/badge";

describe("bookingStatusBadge", () => {
  it.each([
    ["pending", "warning", "Pending"],
    ["confirmed", "info", "Confirmed"],
    ["checked_in", "success", "Checked in"],
    ["checked_out", "outline", "Checked out"],
    ["cancelled", "danger", "Cancelled"],
  ])("maps %s -> %s", (status, variant, label) => {
    expect(bookingStatusBadge(status)).toEqual({ variant, label });
  });

  it("falls back to the raw value for unknown statuses", () => {
    expect(bookingStatusBadge("weird")).toEqual({
      variant: "default",
      label: "weird",
    });
  });
});

describe("paymentStatusBadge", () => {
  it.each([
    ["paid", "success"],
    ["unpaid", "warning"],
    ["refunded", "outline"],
    ["partially_refunded", "outline"],
    ["failed", "danger"],
  ])("maps %s -> %s", (status, variant) => {
    expect(paymentStatusBadge(status).variant).toBe(variant);
  });
});

describe("roomStatusBadge", () => {
  it.each([
    ["available", "success"],
    ["occupied", "info"],
    ["cleaning", "warning"],
    ["maintenance", "danger"],
  ])("maps %s -> %s", (status, variant) => {
    expect(roomStatusBadge(status).variant).toBe(variant);
  });
});

describe("requestStatusBadge", () => {
  it.each([
    ["requested", "warning"],
    ["scheduled", "info"],
    ["in_progress", "info"],
    ["completed", "success"],
    ["cancelled", "danger"],
  ])("maps %s -> %s", (status, variant) => {
    expect(requestStatusBadge(status).variant).toBe(variant);
  });
});
