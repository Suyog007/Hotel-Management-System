-- Display-only "was" price so a room can be advertised at a discount:
-- the site strikes through `original_price` next to the `base_price` it
-- actually charges. Nullable — most room types won't have an offer running.
--
-- This is NOT dynamic pricing (see BUILD_PLAN "What NOT to do"): there is
-- still exactly one chargeable rate per room type, edited by hand. Nothing
-- reads this column for booking math; `lib/pricing` still uses base_price.
alter table room_types
  add column original_price numeric(12,2);

-- A "discount" that isn't cheaper is a data-entry mistake, not an offer.
alter table room_types
  add constraint room_types_original_price_above_base
  check (original_price is null or original_price > base_price);
