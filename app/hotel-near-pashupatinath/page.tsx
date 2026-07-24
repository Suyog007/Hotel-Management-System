import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Plane,
  Sunrise,
} from "lucide-react";
import { TempleIcon, StupaIcon } from "@/components/public/landmark-icons";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { FaqJsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Hotel near Pashupatinath Temple — 5 min walk from Pashupati",
  description:
    "Looking for a hotel near Pashupati? Hotel Vardani in Gaushala is a 5-minute walk from Pashupatinath Temple and 10 minutes from Kathmandu airport. Book direct.",
  alternates: { canonical: "/hotel-near-pashupatinath" },
  openGraph: {
    title: "Hotel near Pashupatinath Temple — 5 min walk from Pashupati",
    description:
      "Stay a 5-minute walk from Pashupatinath Temple in Gaushala, Kathmandu — 10 minutes from Tribhuvan International Airport.",
  },
};

// Same destination link as the footer — anchored to the Google Place ID so
// Maps resolves the right property even if the display name changes.
const DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=Hotel+Vardani&destination_place_id=ChIJCYr9TbcZ6zkR00tXRsiU3eE";

// Static, code-owned copy (not CMS): this page exists to rank for
// "hotel near pashupati(nath)" searches, so the wording is deliberate.
const LANDMARKS = [
  {
    icon: TempleIcon,
    name: "Pashupatinath Temple",
    distance: "5 min walk",
    detail:
      "Out the front door, through Gaushala chowk, and you're at the western gates of the Pashupati temple complex.",
  },
  {
    icon: Plane,
    name: "Tribhuvan International Airport",
    distance: "10 min drive",
    detail:
      "Complimentary airport pickup when you book direct — land, message us, and you're checked in before the jet lag hits.",
  },
  {
    icon: Sunrise,
    name: "Guhyeshwari Temple",
    distance: "15 min walk",
    detail:
      "The Shakti Peetha on the far side of the Pashupatinath complex, an easy riverside walk along the Bagmati.",
  },
  {
    icon: StupaIcon,
    name: "Boudhanath Stupa",
    distance: "10 min drive",
    detail:
      "One of the largest stupas in the world — pair an evening kora at Boudha with morning darshan at Pashupati.",
  },
] as const;

const FAQS = [
  {
    question: "How far is Hotel Vardani from Pashupatinath Temple?",
    answer:
      "About a 5-minute walk. The hotel is in Gaushala, Kathmandu, just west of the Pashupatinath temple complex — close enough to walk to morning darshan and back before breakfast.",
  },
  {
    question: "Is this a good hotel for attending the evening aarti at Pashupatinath?",
    answer:
      "Yes. The Bagmati Ganga Aarti is held on the riverbank inside the Pashupatinath complex every evening, and the walk back to the hotel takes around five minutes — no taxi needed after dark.",
  },
  {
    question: "How far is the hotel from Kathmandu airport?",
    answer:
      "Tribhuvan International Airport is roughly a 10-minute drive from the hotel. Airport pickup is complimentary when you book direct.",
  },
  {
    question: "Can non-Hindu visitors staying at the hotel visit Pashupatinath?",
    answer:
      "The main temple sanctum is open to Hindus only, but the wider complex, the eastern bank of the Bagmati, and the evening aarti are open to all visitors. Our reception can suggest the best route and timings.",
  },
  {
    question: "Is Gaushala a convenient area to stay in Kathmandu?",
    answer:
      "Gaushala sits between the airport and the city centre. Pashupatinath is a short walk away, Boudhanath Stupa is about 10 minutes by car, and Thamel and Durbar Square are around 20–25 minutes away.",
  },
] as const;

export default async function HotelNearPashupatinathPage() {
  const supabase = await createServerClient();
  const [{ data: settings }, { data: rooms }] = await Promise.all([
    supabase
      .from("site_settings")
      .select("hotel_name, currency_symbol")
      .single(),
    supabase
      .from("room_types")
      .select("base_price")
      .eq("is_active", true),
  ]);

  const s = (settings ?? {}) as { hotel_name?: string; currency_symbol?: string };
  const hotelName = s.hotel_name ?? "Hotel Vardani";
  const currency = s.currency_symbol ?? "Rs.";
  const prices =
    (rooms as Array<{ base_price: number | string }> | null)?.map((r) =>
      Number(r.base_price),
    ) ?? [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <>
      <SiteHeader />
      <FaqJsonLd faqs={[...FAQS]} />
      <main id="main">
        {/* ── Intro ─────────────────────────────────────────────────────── */}
        <section className="bg-linen">
          <div className="container py-20 md:py-28">
            <div className="max-w-3xl">
              <p className="eyebrow mb-4 text-oxblood">
                Gaushala · Kathmandu
              </p>
              <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
                A hotel five minutes&apos; walk from Pashupatinath
              </h1>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">
                If you searched for a hotel near Pashupati, this is what
                &ldquo;near&rdquo; actually looks like: {hotelName} sits in
                Gaushala, just west of the Pashupatinath Temple complex. Walk
                to morning darshan, be back for breakfast, and reach Tribhuvan
                International Airport in ten minutes when it&apos;s time to
                leave.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/rooms">
                  <Button size="lg" variant="accent" className="gap-2">
                    See rooms
                    {minPrice !== null && (
                      <span className="opacity-80">
                        from {currency} {minPrice.toLocaleString()}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="gap-2">
                    <MapPin className="h-4 w-4" />
                    Get directions
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Landmark distances ────────────────────────────────────────── */}
        <section aria-label="Nearby landmarks" className="container py-20 md:py-28">
          <div className="mb-10 max-w-2xl md:mb-14">
            <p className="eyebrow mb-3 text-oxblood">From our doorstep</p>
            <h2 className="font-display text-3xl font-semibold md:text-5xl">
              What&apos;s nearby
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {LANDMARKS.map((l) => (
              <article
                key={l.name}
                className="rounded-[4px] border border-foreground/10 bg-card p-6 md:p-8"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[2px] bg-linen text-oxblood">
                    <l.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="font-label rounded-[2px] bg-onyx px-2.5 py-1 text-[11px] text-cream">
                    {l.distance}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-xl font-bold">{l.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {l.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Why Gaushala ──────────────────────────────────────────────── */}
        <section className="bg-emerald text-cream">
          <div className="container py-20 md:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <p className="eyebrow mb-3 text-gold">Why stay this close</p>
                <h2 className="font-display text-display-lg font-bold text-cream">
                  Pashupatinath, on temple time
                </h2>
              </div>
              <div className="space-y-5 text-cream/85 lg:col-span-7">
                <p className="leading-relaxed">
                  Most visitors see Pashupatinath in a rushed afternoon hour
                  between other stops. Staying in Gaushala flips that: you can
                  be at the gates before the tour buses for a quiet morning
                  darshan, come back to rest, and return for the evening
                  Bagmati aarti — all on foot.
                </p>
                <p className="leading-relaxed">
                  During Maha Shivaratri and Teej, when roads around the temple
                  close and taxis can&apos;t get near, being a five-minute walk
                  away is the difference between joining the festival and
                  watching it on your phone.
                </p>
                <p className="leading-relaxed">
                  And because the airport is only ten minutes away, Gaushala
                  works just as well for a one-night stopover as for a longer
                  Kathmandu stay — Boudhanath, Thamel, and Durbar Square are
                  all a short ride out.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQs ──────────────────────────────────────────────────────── */}
        <section aria-label="Frequently asked questions" className="container py-20 md:py-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="eyebrow mb-3 text-oxblood">Staying near the temple</p>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">
                Common questions
              </h2>
            </div>
            <div className="lg:col-span-8">
              <div className="space-y-3">
                {FAQS.map((f) => (
                  <details
                    key={f.question}
                    className="group border-b border-foreground/12 pb-3"
                  >
                    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 py-3 text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                      {f.question}
                      <span
                        aria-hidden
                        className="font-display shrink-0 text-2xl leading-none text-oxblood transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {f.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="container pb-24 md:pb-32">
          <div className="overflow-hidden rounded-[6px] bg-oxblood px-8 py-14 text-cream md:px-16 md:py-20">
            <div className="grid items-center gap-8 md:grid-cols-12">
              <div className="md:col-span-8">
                <h2 className="font-display text-display-lg font-bold leading-tight text-cream">
                  Wake up next to Pashupatinath.
                </h2>
                <p className="mt-4 max-w-xl text-cream/85">
                  Book direct for the best rate and complimentary airport
                  pickup — no account needed, just an email code.
                </p>
              </div>
              <div className="md:col-span-4 md:text-right">
                <Link href="/rooms">
                  <Button size="lg" className="gap-2 bg-gold text-onyx hover:bg-gold-light">
                    Book a room
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
