/**
 * Hotel-local time helpers.
 *
 * The property is in Kathmandu (UTC+5:45). "Today", the default check-in date,
 * and hours-until-check-in must be computed in this zone — using UTC instead
 * lets a guest booking between 00:00 and 05:45 local time land on the wrong
 * calendar day, and shifts refund tiers by the offset.
 */
const OFFSET_MINUTES = 5 * 60 + 45; // +05:45
const OFFSET_MS = OFFSET_MINUTES * 60_000;
export const HOTEL_UTC_OFFSET = "+05:45";

/** YYYY-MM-DD for "now" in the hotel's local timezone. */
export function hotelToday(now: Date = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD `offsetDays` away from the hotel-local today. */
export function hotelDateFromToday(offsetDays: number, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

/** The instant of hotel-local midnight at the start of a YYYY-MM-DD date. */
export function hotelMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${HOTEL_UTC_OFFSET}`);
}
