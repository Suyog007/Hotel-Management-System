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
 * Optional air-conditioning add-on. Offered on Standard rooms only (Deluxe and
 * Suite already include AC). A flat amount added to the subtotal, so tax and
 * service charge apply on top like any other room charge.
 */
export const AC_ADDON_PRICE = 500;

/**
 * Standard rooms qualify for the optional AC upgrade. Matches any slug that
 * starts with "standard" (e.g. "standard", "standard-single", "standard-double")
 * so renamed/variant Standard room types still get the option.
 */
export function isAcAddonEligible(slug: string | null | undefined): boolean {
  return (slug ?? "").toLowerCase().startsWith("standard");
}

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
