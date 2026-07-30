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

/**
 * Hotel Vardani charges the room rate only — no tax, no service charge. These
 * are the single source of truth for every booking path (guest, walk-in,
 * extend-stay); the `site_settings` tax/service columns are not used for
 * pricing. Set to a non-zero fraction (e.g. 0.13) here to reinstate them.
 */
export const TAX_RATE = 0;
export const SERVICE_CHARGE_RATE = 0;

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
  /** Flat add-on(s) folded into the subtotal before tax/service (e.g. AC). */
  addonAmount?: number;
}): BookingTotals {
  const subtotal = round2(args.basePrice * args.nights + (args.addonAmount ?? 0));
  const taxAmount = round2(subtotal * args.taxRate);
  const serviceAmount = round2(subtotal * args.serviceRate);
  const total = round2(subtotal + taxAmount + serviceAmount);
  return { nights: args.nights, subtotal, taxAmount, serviceAmount, total };
}
