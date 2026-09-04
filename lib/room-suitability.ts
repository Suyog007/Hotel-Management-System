/**
 * Order room types by how well they suit a party of `guests`, best first:
 *   1. Rooms that fit the party (max_guests >= guests) before ones that don't.
 *   2. Among those, the tightest fit first (smallest max_guests) — a solo guest
 *      sees the cosy double before the six-bed suite.
 *   3. Ties broken by nightly price, cheapest first.
 *
 * Returns a new array; the input is not mutated. Used on the public /rooms
 * listing once a search sets a guest count. With no search, the admin's
 * curated `sort_order` is kept instead.
 */
export function sortBySuitability<
  T extends { max_guests: number; base_price: number },
>(rooms: readonly T[], guests: number): T[] {
  return [...rooms].sort((a, b) => {
    const aFits = a.max_guests >= guests ? 0 : 1;
    const bFits = b.max_guests >= guests ? 0 : 1;
    if (aFits !== bFits) return aFits - bFits;
    if (a.max_guests !== b.max_guests) return a.max_guests - b.max_guests;
    return a.base_price - b.base_price;
  });
}
