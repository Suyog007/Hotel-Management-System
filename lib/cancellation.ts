/**
 * Computes the refund tier and amount for a booking being cancelled.
 *
 * The cancellation_policy table holds tiers like:
 *   hours_before_checkin: 72, refund_percentage: 100  → "≥72h: full refund"
 *   hours_before_checkin: 24, refund_percentage: 50   → "24–72h: half"
 *   hours_before_checkin:  0, refund_percentage:  0   → "<24h: nothing"
 *
 * We sort tiers by `hours_before_checkin` descending and pick the first
 * tier whose threshold is ≤ the actual hours-until-check-in.
 */
export type CancellationTier = {
  id?: string;
  hours_before_checkin: number;
  refund_percentage: number;
  label: string | null;
};

export type RefundComputation = {
  tier: CancellationTier | null;
  refundAmount: number;
  hoursUntilCheckIn: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeRefund(args: {
  paidAmount: number;
  checkIn: string; // YYYY-MM-DD
  now?: Date;
  tiers: CancellationTier[];
}): RefundComputation {
  const now = args.now ?? new Date();
  const checkInDate = new Date(args.checkIn + "T00:00:00Z");
  const hoursUntil = Math.max(
    0,
    (checkInDate.getTime() - now.getTime()) / 3_600_000,
  );

  const sorted = [...args.tiers].sort(
    (a, b) => b.hours_before_checkin - a.hours_before_checkin,
  );
  const tier = sorted.find((t) => t.hours_before_checkin <= hoursUntil) ?? null;

  if (!tier) return { tier: null, refundAmount: 0, hoursUntilCheckIn: hoursUntil };

  const refundAmount = round2((args.paidAmount * tier.refund_percentage) / 100);
  return { tier, refundAmount, hoursUntilCheckIn: hoursUntil };
}
