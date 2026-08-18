/**
 * Syncs rooms + room_types to the owner's handwritten inventory (2026-08-18).
 *
 * Target: 27 physical rooms across 8 room types. The previous 9 placeholder
 * rooms (601-609) are replaced: 601/602/603 keep their numbers but change
 * type (601 has a real booking, so the row must survive), 604-609 are
 * deleted. "Extra bed available" is recorded as a room_type amenity on
 * Deluxe Twin and Deluxe Double only. The Deluxe Single type has no
 * physical rooms and is deleted.
 *
 *   node scripts/sync-room-inventory.mjs           # dry run, lists planned changes
 *   node scripts/sync-room-inventory.mjs --execute # actually apply
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const EXECUTE = process.argv.includes("--execute");
const EXTRA_BED = "Extra bed available";

// slug -> room numbers (floor is the first digit of the number)
const INVENTORY = {
  "deluxe-twin": ["301", "302", "303", "305", "403", "404", "405"],
  premium: ["304"],
  "premium-suite": ["401"],
  "deluxe-double": ["306", "402", "406"],
  "twin-standard": ["601", "701", "801", "901"],
  "twin-ac": ["703", "803"],
  "double-nonac": ["603", "704", "804", "904"],
  "twin-nonac": ["602", "702", "802", "902", "903"],
};
const EXTRA_BED_SLUGS = ["deluxe-twin", "deluxe-double"];
const DELETE_TYPE_SLUGS = ["deluxe-single"];

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const fail = (msg, error) => {
  console.error(msg, error?.message ?? error ?? "");
  process.exit(1);
};

const { data: types, error: typesErr } = await db.from("room_types").select("id,slug,amenities");
if (typesErr) fail("Could not list room types:", typesErr);
const typeBySlug = Object.fromEntries(types.map((t) => [t.slug, t]));

for (const slug of Object.keys(INVENTORY)) {
  if (!typeBySlug[slug]) fail(`Room type '${slug}' not found in DB — aborting, nothing changed.`);
}

const { data: rooms, error: roomsErr } = await db.from("rooms").select("id,room_number,type_id,floor");
if (roomsErr) fail("Could not list rooms:", roomsErr);
const roomByNumber = Object.fromEntries(rooms.map((r) => [r.room_number, r]));

const wanted = new Map(); // room_number -> slug
for (const [slug, numbers] of Object.entries(INVENTORY))
  for (const n of numbers) {
    if (wanted.has(n)) fail(`Room ${n} listed under two types — fix INVENTORY.`);
    wanted.set(n, slug);
  }

// Plan
const toInsert = [];
const toRetype = [];
for (const [number, slug] of wanted) {
  const floor = Number(number[0]);
  const existing = roomByNumber[number];
  if (!existing) toInsert.push({ room_number: number, type_id: typeBySlug[slug].id, floor, status: "available" });
  else if (existing.type_id !== typeBySlug[slug].id || existing.floor !== floor)
    toRetype.push({ id: existing.id, room_number: number, type_id: typeBySlug[slug].id, floor, slug });
}
const toDelete = rooms.filter((r) => !wanted.has(r.room_number));

const label = EXECUTE ? "" : "[dry run] ";
console.log(`${label}Plan:`);
console.log(`  create ${toInsert.length} room(s): ${toInsert.map((r) => r.room_number).join(", ") || "-"}`);
for (const r of toRetype) console.log(`  retype room ${r.room_number} -> ${r.slug} (floor ${r.floor})`);
console.log(`  delete ${toDelete.length} room(s): ${toDelete.map((r) => r.room_number).join(", ") || "-"}`);
for (const slug of Object.keys(INVENTORY)) {
  const has = (typeBySlug[slug].amenities ?? []).includes(EXTRA_BED);
  const should = EXTRA_BED_SLUGS.includes(slug);
  if (should && !has) console.log(`  add '${EXTRA_BED}' amenity to ${slug}`);
  if (!should && has) console.log(`  remove '${EXTRA_BED}' amenity from ${slug}`);
}
for (const slug of DELETE_TYPE_SLUGS)
  if (typeBySlug[slug]) console.log(`  delete room type '${slug}'`);

if (!EXECUTE) {
  console.log("\nRe-run with --execute to apply.");
  process.exit(0);
}

// Apply — order matters: retype before deleting types, delete rooms before inserts
// is not required (room numbers are disjoint), but deletes go first anyway.
for (const r of toDelete) {
  const { error } = await db.from("rooms").delete().eq("id", r.id);
  if (error) fail(`Could not delete room ${r.room_number} (booked?):`, error);
  console.log(`  deleted room ${r.room_number}`);
}
for (const r of toRetype) {
  const { error } = await db.from("rooms").update({ type_id: r.type_id, floor: r.floor }).eq("id", r.id);
  if (error) fail(`Could not retype room ${r.room_number}:`, error);
  console.log(`  retyped room ${r.room_number} -> ${r.slug}`);
}
if (toInsert.length > 0) {
  const { error } = await db.from("rooms").insert(toInsert);
  if (error) fail("Could not insert new rooms:", error);
  console.log(`  created ${toInsert.length} room(s)`);
}
for (const slug of Object.keys(INVENTORY)) {
  const amenities = (typeBySlug[slug].amenities ?? []).filter((a) => a !== EXTRA_BED);
  if (EXTRA_BED_SLUGS.includes(slug)) amenities.push(EXTRA_BED);
  const { error } = await db.from("room_types").update({ amenities }).eq("id", typeBySlug[slug].id);
  if (error) fail(`Could not update amenities on ${slug}:`, error);
}
console.log("  amenities updated");
for (const slug of DELETE_TYPE_SLUGS) {
  if (!typeBySlug[slug]) continue;
  const { error } = await db.from("room_types").delete().eq("id", typeBySlug[slug].id);
  if (error) fail(`Could not delete room type '${slug}':`, error);
  console.log(`  deleted room type '${slug}'`);
}

// Verify
const { count: roomCount } = await db.from("rooms").select("*", { count: "exact", head: true });
const { count: typeCount } = await db.from("room_types").select("*", { count: "exact", head: true });
console.log(`\nDone. rooms=${roomCount} (expect 27), room_types=${typeCount} (expect 8).`);
