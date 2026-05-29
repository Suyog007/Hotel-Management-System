/**
 * Pricing math is intentionally trivial: subtotal = base_price × nights,
 * then tax_rate and service_charge_rate (from site_settings) are layered on
 * top of the subtotal. No calendar overrides, no rule engine. The result is
 * snapshotted onto bookings.total_amount at booking time.
 */
export type BookingTotals = {
  nights: number;
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  total: number;
};

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn);
  const b = Date.parse(checkOut);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateBookingTotal(args: {
  basePrice: number;
  nights: number;
  taxRate: number;
  serviceRate: number;
}): BookingTotals {
  const subtotal = round2(args.basePrice * args.nights);
  const taxAmount = round2(subtotal * args.taxRate);
  const serviceAmount = round2(subtotal * args.serviceRate);
  const total = round2(subtotal + taxAmount + serviceAmount);
  return { nights: args.nights, subtotal, taxAmount, serviceAmount, total };
}
