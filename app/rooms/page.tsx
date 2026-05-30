import Link from "next/link";
import { ArrowRight, Users, Sparkles, CalendarDays } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { countAvailableRooms } from "@/lib/availability";
import { calculateBookingTotal, nightsBetween } from "@/lib/pricing";

type RoomTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
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
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();

  const [{ data: types }, { data: settings }] = await Promise.all([
    supabase
      .from("room_types")
      .select("id, name, slug, description, base_price, max_guests, amenities, images")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("site_settings")
      .select("currency_symbol, tax_rate, service_charge_rate")
      .single(),
  ]);
  const rows = ((types as RoomTypeRow[] | null) ?? []).map((r) => ({
    ...r,
    base_price: Number(r.base_price),
  }));
  const s = (settings ?? {}) as {
    currency_symbol?: string;
    tax_rate?: number | string;
    service_charge_rate?: number | string;
  };
  const symbol = s.currency_symbol ?? "Rs.";
  const taxRate = Number(s.tax_rate ?? 0);
  const serviceRate = Number(s.service_charge_rate ?? 0);

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

  // Enrich each room with availability count + total for the requested stay.
  const enriched: EnrichedRow[] = await Promise.all(
    rows.map(async (rt) => {
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

  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-12 md:py-16">
        <PageHeader
          eyebrow="Stay with us"
          title="Our rooms"
          description={
            stay
              ? `Showing availability for ${stay.nights} night${stay.nights === 1 ? "" : "s"} · ${stay.guests} guest${stay.guests === 1 ? "" : "s"}. Totals include tax and service.`
              : "Pick a room to see availability and book. Prices include nightly base rate; tax and service are added at checkout."
          }
        />

        {stay && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <CalendarDays className="h-4 w-4 text-accent" />
            <span className="font-medium">
              {formatDate(stay.checkIn)} → {formatDate(stay.checkOut)}
            </span>
            <span className="text-muted-foreground">
              · {stay.nights} night{stay.nights === 1 ? "" : "s"} · {stay.guests}{" "}
              guest{stay.guests === 1 ? "" : "s"}
            </span>
            <Link
              href="/#hero-search"
              className="ml-auto text-xs font-medium text-accent hover:underline"
            >
              Change dates
            </Link>
          </div>
        )}

        {enriched.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No rooms available"
            description="Rooms will appear here once they're added in the dashboard."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enriched.map((rt) => (
              <RoomCard key={rt.id} rt={rt} symbol={symbol} stay={stay} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const cover = (rt.images ?? [])[0];
  const soldOut = stay && rt.availableCount === 0;
  const overCapacity = stay && rt.exceedsCapacity;
  const unbookable = soldOut || overCapacity;

  // When a stay is selected, the card links carry the params through so the
  // booking form on /rooms/[slug] pre-fills. Otherwise it's a plain link.
  const href = stay
    ? `/rooms/${rt.slug}?check_in=${stay.checkIn}&check_out=${stay.checkOut}&guests=${stay.guests}`
    : `/rooms/${rt.slug}`;

  const Wrapper = unbookable
    ? ({ children }: { children: React.ReactNode }) => (
        <div className="block opacity-60">{children}</div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Link href={href} className="group block">
          {children}
        </Link>
      );

  return (
    <Wrapper>
      <article className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cover}
              alt={rt.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
              <span className="font-display text-3xl font-semibold text-foreground/30">
                {rt.name}
              </span>
            </div>
          )}
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-soft backdrop-blur">
            <Users className="h-3 w-3" />
            Sleeps {rt.max_guests}
          </div>
          {stay && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-soft backdrop-blur"
              style={{
                background: soldOut
                  ? "rgb(220 38 38 / 0.95)"
                  : "rgb(22 163 74 / 0.95)",
                color: "white",
              }}
            >
              {soldOut
                ? "Sold out"
                : `${rt.availableCount} room${rt.availableCount === 1 ? "" : "s"} left`}
            </div>
          )}
          <div className="absolute bottom-3 right-3 rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background backdrop-blur">
            {stay && rt.totalForStay !== null ? (
              <>
                {symbol} {rt.totalForStay.toLocaleString()}{" "}
                <span className="opacity-70">total</span>
              </>
            ) : (
              <>
                {symbol} {Number(rt.base_price).toLocaleString()}{" "}
                <span className="opacity-70">/ night</span>
              </>
            )}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold leading-tight">
              {rt.name}
            </h2>
            {!unbookable && (
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            )}
          </div>
          {rt.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {rt.description}
            </p>
          )}
          {!stay && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent">
              <CalendarDays className="h-3.5 w-3.5" />
              Add dates above to see your total price
            </p>
          )}
          {overCapacity && !soldOut && (
            <p className="mt-3 text-xs text-danger">
              Sleeps {rt.max_guests} only · pick a larger room for {stay?.guests}{" "}
              guests
            </p>
          )}
          {(rt.amenities ?? []).length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {(rt.amenities ?? []).slice(0, 4).map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {a}
                </li>
              ))}
              {(rt.amenities ?? []).length > 4 && (
                <li className="text-xs text-muted-foreground">
                  +{(rt.amenities ?? []).length - 4} more
                </li>
              )}
            </ul>
          )}
        </div>
      </article>
    </Wrapper>
  );
}
