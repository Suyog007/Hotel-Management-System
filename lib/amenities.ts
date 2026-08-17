/**
 * The amenities every room is likely to have, so the picker isn't empty on a
 * fresh install. The rooms page merges these with whatever the existing room
 * types already use, which is what keeps the vocabulary from drifting into
 * "AC", "A/C" and "Air conditioning" all meaning the same thing.
 *
 * Lives outside the AmenityPicker's "use client" module so server components
 * can read the real array — every export of a client module turns into an
 * opaque client reference on the server, and calling .map() on one crashes
 * the page.
 */
export const COMMON_ROOM_AMENITIES = [
  "Wi-Fi",
  "Hot shower",
  "Attached bathroom",
  "Television",
  "Tea/Coffee",
  "Air conditioning",
  "Ceiling fan",
  "Mini-fridge",
  "Workspace",
  "Balcony",
  "City view",
  "Room service",
];
