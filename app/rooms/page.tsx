import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Users, Sparkles, CalendarDays } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Rooms",
  description:
    "Rooms at Hotel Vardani in Gaushala, Kathmandu — 5 minutes from Pashupatinath, 10 minutes from Tribhuvan International Airport. Standard, premium, and suite options.",
  alternates: { canonical: "/rooms" },
};
import { SiteHeader } from "@/components/public/site-header";
import { CardImageSlider } from "@/components/public/card-image-slider";
import { GroupRoomPicker } from "@/components/public/group-room-picker";
import { HeroSearch } from "@/components/public/hero-search";
import { initiateGroupBooking } from "./group-actions";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { countAvailableRooms } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween, TAX_RATE, SERVICE_CHARGE_RATE } from "@/lib/pricing";

type RoomTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  original_price: number | null;
  max_guests: number;
  amenities: string[] | null;
  images: string[] | null;
};

type StayContext = {
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
} | null;

type EnrichedRow = RoomTypeRow & {
  availableCount: number | null;
  totalForStay: number | null;
  exceedsCapacity: boolean;
};

export default async function RoomsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    check_in?: string;
    check_out?: string;
    guests?: string;
    max_price?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();

  const [{ data: types }, { data: settings }] = await Promise.all([
    supabase
      .from("room_types")
      .select("id, name, slug, description, base_price, original_price, max_guests, amenities, images")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("site_settings")
      .select("currency_symbol, tax_rate, service_charge_rate, contact_phone")
      .single(),
  ]);
  const rows = ((types as RoomTypeRow[] | null) ?? []).map((r) => ({
    ...r,
    base_price: Number(r.base_price),
    original_price: r.original_price === null ? null : Number(r.original_price),
  }));
  const s = (settings ?? {}) as {
    currency_symbol?: string;
    tax_rate?: number | string;
    service_charge_rate?: number | string;
    contact_phone?: string | null;
  };
  const symbol = s.currency_symbol ?? "Rs.";
  // contact_phone may list several numbers ("+977 974… · 01-59…"); a tel:
  // link needs exactly one, so take the first.
  const contactPhone =
    (s.contact_phone ?? "").split(/[·,/|]/)[0]?.trim() || null;
  // Room rate only — no tax or service charge (see lib/pricing constants).
  const taxRate = TAX_RATE;
  const serviceRate = SERVICE_CHARGE_RATE;

  // Stay context: only honor search params when both dates parse and form a
  // positive-night range. Anything malformed degrades to "no stay context"
  // and the no-dates prompt renders.
  let stay: StayContext = null;
  if (sp.check_in && sp.check_out) {
    const nights = nightsBetween(sp.check_in, sp.check_out);
    if (nights > 0) {
      stay = {
        checkIn: sp.check_in,
        checkOut: sp.check_out,
        guests: Math.max(1, parseInt(sp.guests ?? "1", 10) || 1),
        nights,
      };
    }
  }

  // Optional nightly price cap; malformed values degrade to "no cap".
  const parsedMaxPrice = Number.parseFloat(sp.max_price ?? "");
  const maxPrice =
    Number.isFinite(parsedMaxPrice) && parsedMaxPrice > 0 ? parsedMaxPrice : null;
  const pricedRows = maxPrice
    ? rows.filter((r) => r.base_price <= maxPrice)
    : rows;

  // Enrich each room with availability count + total for the requested stay.
  const enriched: EnrichedRow[] = await Promise.all(
    pricedRows.map(async (rt) => {
      if (!stay) {
        return {
          ...rt,
          availableCount: null,
          totalForStay: null,
          exceedsCapacity: false,
        };
      }
      const availableCount = await countAvailableRooms(
        supabase,
        rt.id,
        stay.checkIn,
        stay.checkOut,
      );
      const { total } = calculateBookingTotal({
        basePrice: rt.base_price,
        nights: stay.nights,
        taxRate,
        serviceRate,
      });
      return {
        ...rt,
        availableCount,
        totalForStay: total,
        exceedsCapacity: stay.guests > rt.max_guests,
      };
    }),
  );

  // A party bigger than the largest room can never fit in one room, on any
  // dates — dropping every room would read as "sold out" and dead-end the
  // guest. Keep available rooms on screen instead and explain (via the
  // group-stay banner below) that the party books across several rooms.
  const largestCapacity =
    rows.length > 0 ? Math.max(...rows.map((r) => r.max_guests)) : 0;
  const groupStay = stay !== null && rows.length > 0 && stay.guests > largestCapacity;

  // With a stay selected, show only what the guest can actually book —
  // sold-out and too-small rooms are dropped, not dimmed.
  const visible = stay
    ? enriched.filter(
        (rt) =>
          (rt.availableCount ?? 0) > 0 && (groupStay || !rt.exceedsCapacity),
      )
    : enriched;

  const clearPriceHref = stay
    ? `/rooms?check_in=${stay.checkIn}&check_out=${stay.checkOut}&guests=${stay.guests}`
    : "/rooms";

  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-12 md:py-16">
        <PageHeader
          eyebrow="Stay with us"
          title="Rooms at Hotel Vardani, Gaushala"
          description={
            stay
              ? `Showing rooms available for ${stay.nights} night${stay.nights === 1 ? "" : "s"} · ${stay.guests} guest${stay.guests === 1 ? "" : "s"}. You pay the room rate only — no tax or service charge.`
              : "Pick a room to see availability and book. You pay the nightly room rate only."
          }
        />

        {sp.error && (
          <div
            role="alert"
            className="mb-8 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {sp.error}
          </div>
        )}

        <div
          id="rooms-filter"
          className="mb-8 rounded-2xl border border-border/60 shadow-soft"
        >
          <HeroSearch
            priceOptions={[...new Set(rows.map((r) => r.base_price))].sort(
              (a, b) => a - b,
            )}
            symbol={symbol}
            initialCheckIn={stay?.checkIn}
            initialCheckOut={stay?.checkOut}
            initialGuests={stay?.guests}
            initialMaxPrice={maxPrice !== null ? String(maxPrice) : undefined}
          />
        </div>

        {groupStay && stay && visible.length > 0 && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              <span className="font-medium">Travelling as a group?</span> Our
              largest room sleeps {largestCapacity}, so a party of{" "}
              {stay.guests} stays across at least{" "}
              {Math.ceil(stay.guests / largestCapacity)} rooms. Add rooms below
              with the <span className="font-medium">+</span> buttons until
              everyone has a bed, then book them all together in one go
              {contactPhone ? (
                <>
                  {" "}
                  — or call us at{" "}
                  <a
                    href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {contactPhone}
                  </a>{" "}
                  and we&apos;ll arrange the whole group at once.
                </>
              ) : (
                "."
              )}
            </p>
          </div>
        )}

        {visible.length === 0 ? (
          rows.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No rooms available"
              description="Rooms will appear here once they're added in the dashboard."
            />
          ) : stay ? (
            <EmptyState
              icon={CalendarDays}
              title={
                maxPrice !== null
                  ? "Nothing available in this price range"
                  : "Sold out for these dates"
              }
              description={
                maxPrice !== null
                  ? `No rooms up to ${symbol} ${maxPrice.toLocaleString()} / night are free for your dates. Try raising the price cap or picking different dates.`
                  : groupStay
                    ? "All rooms are booked for these dates. Try different dates."
                    : "Every room that fits your party is booked for these dates. Try different dates."
              }
              action={
                <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-accent">
                  {maxPrice !== null && (
                    <Link href={clearPriceHref} className="hover:underline">
                      Clear price filter
                    </Link>
                  )}
                  <a href="#rooms-filter" className="hover:underline">
                    Change dates
                  </a>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No rooms in this price range"
              description={`Every room is above ${symbol} ${maxPrice?.toLocaleString()} / night.`}
              action={
                <Link
                  href={clearPriceHref}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Clear price filter
                </Link>
              }
            />
          )
        ) : groupStay && stay ? (
          <GroupRoomPicker
            rooms={visible.map((rt) => ({
              id: rt.id,
              name: rt.name,
              slug: rt.slug,
              description: rt.description,
              maxGuests: rt.max_guests,
              availableCount: rt.availableCount ?? 0,
              totalForStay: rt.totalForStay ?? 0,
            }))}
            roomImages={Object.fromEntries(
              visible.map((rt) => [rt.id, rt.images ?? []]),
            )}
            stay={stay}
            symbol={symbol}
            action={initiateGroupBooking}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((rt) => (
              <RoomCard key={rt.id} rt={rt} symbol={symbol} stay={stay} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function RoomCard({
  rt,
  symbol,
  stay,
}: {
  rt: EnrichedRow;
  symbol: string;
  stay: StayContext;
}) {
  const images = rt.images ?? [];

  // When a stay is selected, the card links carry the params through so the
  // booking form on /rooms/[slug] pre-fills. Otherwise it's a plain link.
  // Unavailable rooms never reach this component — the page filters them out.
  const href = stay
    ? `/rooms/${rt.slug}?check_in=${stay.checkIn}&check_out=${stay.checkOut}&guests=${stay.guests}`
    : `/rooms/${rt.slug}`;

  return (
    // h-full + flex-col all the way down: grid rows stretch every card to the
    // tallest in the row, so a room with two lines of amenities can't leave the
    // one beside it ending short.
    <Link href={href} className="group flex h-full">
      <article className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
          {images.length > 0 ? (
            <CardImageSlider
              images={images}
              alt={`${rt.name} at Hotel Vardani, Gaushala`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
              <span className="font-display text-3xl font-semibold text-foreground/30">
                {rt.name}
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-soft backdrop-blur">
            <Users className="h-3 w-3" />
            Sleeps {rt.max_guests}
          </div>
          {stay && (
            <div
              className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-soft backdrop-blur"
              style={{ background: "rgb(22 163 74 / 0.95)", color: "white" }}
            >
              {rt.availableCount} room{rt.availableCount === 1 ? "" : "s"} left
            </div>
          )}
          {/* The price is the deciding fact on this card, so it gets display
              type on a solid gold pill — the same gold-on-onyx pairing as the
              "Book a room" button, so the price visually points at booking.
              Struck original sits above in small type: the discount reads at
              a glance without stealing width from the real price. */}
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg bg-gold px-3.5 py-2 text-right text-onyx shadow-soft">
            {stay && rt.totalForStay !== null ? (
              <>
                <span className="font-display text-2xl font-bold leading-none">
                  {symbol} {rt.totalForStay.toLocaleString()}
                </span>{" "}
                <span className="text-xs font-medium text-onyx/70">total</span>
              </>
            ) : (
              <>
                {rt.original_price !== null && (
                  <span className="block text-xs leading-tight text-onyx/60 line-through">
                    {symbol} {Number(rt.original_price).toLocaleString()}
                  </span>
                )}
                <span className="font-display text-2xl font-bold leading-none">
                  {symbol} {Number(rt.base_price).toLocaleString()}
                </span>{" "}
                <span className="text-xs font-medium text-onyx/70">/ night</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold leading-tight">
              {rt.name}
            </h2>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          {/* Always rendered, always two lines tall: a room with no description
              would otherwise pull everything below it up out of line. */}
          <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {rt.description}
          </p>
          {!stay && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent">
              <CalendarDays className="h-3.5 w-3.5" />
              Add dates above to see your total price
            </p>
          )}
          {/* mt-auto pins the chips to the bottom edge of every card, so the
              rows line up even when one room lists three amenities and the
              next lists six. Three chips is what fits on one line in a
              lg:grid-cols-3 column — a fourth wrapped and made cards ragged. */}
          {(rt.amenities ?? []).length > 0 && (
            <ul className="mt-auto flex flex-wrap gap-1.5 pt-4">
              {(rt.amenities ?? []).slice(0, 3).map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {a}
                </li>
              ))}
              {(rt.amenities ?? []).length > 3 && (
                <li className="px-1 py-0.5 text-xs text-muted-foreground">
                  +{(rt.amenities ?? []).length - 3} more
                </li>
              )}
            </ul>
          )}
        </div>
      </article>
    </Link>
  );
}
