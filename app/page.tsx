import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Wifi,
  Sparkles,
  Coffee,
  Waves,
  Utensils,
  Dumbbell,
  Car,
  ConciergeBell,
  Martini,
  Sparkle,
  Star,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { GalleryTeaser } from "@/components/public/gallery-teaser";
import { GoogleRatingChip } from "@/components/public/google-rating-chip";
import { HeroSearch } from "@/components/public/hero-search";
import { type SliderReview } from "@/components/public/reviews-slider";
import { Button } from "@/components/ui/button";

type RoomType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  max_guests: number;
  images: string[] | null;
};

type Amenity = { name: string; icon: string | null };
type GalleryItem = { id: string; image_url: string; caption: string | null; category: string | null };
type Faq = { id: string; question: string; answer: string };

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  waves: Waves,
  sparkles: Sparkles,
  utensils: Utensils,
  dumbbell: Dumbbell,
  car: Car,
  "concierge-bell": ConciergeBell,
  martini: Martini,
  coffee: Coffee,
};

export default async function HomePage() {
  const supabase = await createServerClient();

  const [settingsRes, roomsRes, amenitiesRes, galleryRes, faqsRes, reviewsRes, testimonialsRes, menuRes] = await Promise.all([
    supabase
      .from("site_settings")
      .select(
        "hotel_name, tagline, address, currency_symbol, google_place_id, google_place_rating, google_place_rating_count, google_place_uri",
      )
      .single(),
    supabase
      .from("room_types")
      .select("id, name, slug, description, base_price, max_guests, images")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("amenities")
      .select("name, icon")
      .eq("is_visible", true)
      .order("sort_order"),
    supabase
      .from("gallery_images")
      .select("id, image_url, caption, category")
      .eq("is_visible", true)
      .order("sort_order"),
    supabase
      .from("faqs")
      .select("id, question, answer")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(6),
    supabase
      .from("google_reviews_cache")
      .select("id, author_name, author_photo_url, rating, comment, published_at")
      .order("published_at", { ascending: false })
      .limit(8),
    supabase
      .from("testimonials")
      .select("id, author_name, author_role, body, rating, image_url")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(8),
    supabase
      .from("food_items")
      .select("id, name, description, price, category, image_url")
      .eq("is_available", true)
      .order("category")
      .order("sort_order")
      .limit(4),
  ]);

  const s = (settingsRes.data ?? {}) as {
    hotel_name?: string;
    tagline?: string;
    address?: string;
    currency_symbol?: string;
    google_place_id?: string | null;
    google_place_rating?: number | null;
    google_place_rating_count?: number | null;
    google_place_uri?: string | null;
  };
  const hotelName = s.hotel_name ?? "Hotel";
  const tagline = s.tagline ?? "Boutique hospitality, made simple.";
  const currency = s.currency_symbol ?? "Rs.";
  const google = {
    rating: s.google_place_rating ? Number(s.google_place_rating) : null,
    ratingCount: s.google_place_rating_count ?? null,
    uri: s.google_place_uri ?? null,
    reviewsUri: s.google_place_id
      ? `https://search.google.com/local/reviews?placeid=${s.google_place_id}`
      : s.google_place_uri ?? null,
  };

  const rooms = ((roomsRes.data as RoomType[] | null) ?? []).map((r) => ({
    ...r,
    base_price: Number(r.base_price),
  }));
  const amenities = (amenitiesRes.data as Amenity[] | null) ?? [];
  const gallery = (galleryRes.data as GalleryItem[] | null) ?? [];
  const faqs = (faqsRes.data as Faq[] | null) ?? [];
  const menuItems =
    (menuRes.data as Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      category: string;
      image_url: string | null;
    }> | null) ?? [];
  const googleReviews =
    (reviewsRes.data as Array<{
      id: string;
      author_name: string;
      author_photo_url: string | null;
      rating: number;
      comment: string | null;
      published_at: string;
    }> | null) ?? [];
  const testimonials =
    (testimonialsRes.data as Array<{
      id: string;
      author_name: string;
      author_role: string | null;
      body: string;
      rating: number | null;
      image_url: string | null;
    }> | null) ?? [];

  // Slider source: prefer Google when we have at least 3 cached. Otherwise
  // fall back to manually-curated testimonials so the slider stays full.
  const sliderReviews: SliderReview[] =
    googleReviews.length >= 3
      ? googleReviews.map((r) => ({
          id: `g-${r.id}`,
          source: "google" as const,
          author_name: r.author_name,
          author_role: null,
          author_photo_url: r.author_photo_url,
          rating: r.rating,
          body: r.comment ?? "",
          published_at: r.published_at,
        }))
      : testimonials.map((t) => ({
          id: `t-${t.id}`,
          source: "testimonial" as const,
          author_name: t.author_name,
          author_role: t.author_role,
          author_photo_url: t.image_url,
          rating: t.rating,
          body: t.body,
          published_at: null,
        }));

  // Hero photo: prefer Exterior, fall back to first gallery photo.
  const heroPhoto =
    gallery.find((g) => g.category === "Exterior")?.image_url ??
    gallery[0]?.image_url ??
    rooms[0]?.images?.[0] ??
    null;



  const minPrice = rooms.reduce<number | undefined>(
    (acc, r) => (acc === undefined || r.base_price < acc ? r.base_price : acc),
    undefined,
  );

  // Featured rooms for the homepage teaser: cheapest, median, top-tier.
  const sortedByPrice = [...rooms].sort((a, b) => a.base_price - b.base_price);
  const featured =
    sortedByPrice.length >= 3
      ? [
          sortedByPrice[0],
          sortedByPrice[Math.floor(sortedByPrice.length / 2)],
          sortedByPrice[sortedByPrice.length - 1],
        ]
      : sortedByPrice;
  const galleryStrip = gallery.filter((g) => g.image_url !== heroPhoto).slice(0, 6);

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* ── Cinematic hero ────────────────────────────────────────────── */}
        <section className="relative isolate flex min-h-[88vh] items-end overflow-hidden">
          {heroPhoto ? (
            <Image
              src={heroPhoto}
              alt={`${hotelName} exterior — boutique hotel in Gaushala, Kathmandu, 5 minutes from Pashupatinath`}
              fill
              priority
              sizes="100vw"
              className="absolute inset-0 -z-10 object-cover"
            />
          ) : (
            <div className="absolute inset-0 -z-10 bg-linen" />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-foreground/85 via-foreground/40 to-foreground/30" />

          <div className="container relative pb-16 pt-32 md:pb-24 md:pt-44">
            <div className="max-w-3xl text-primary-foreground">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur">
                  <Sparkle className="h-3 w-3" />
                  Boutique hospitality
                </p>
                <GoogleRatingChip summary={google} variant="dark" />
              </div>
              <h1 className="font-display text-4xl font-semibold leading-[1.05] md:text-6xl lg:text-7xl">
                {tagline}
              </h1>
              <p className="mt-6 max-w-xl text-base text-primary-foreground/85 md:text-lg">
                {hotelName} — a quiet, locally-rooted stay with a kitchen that nails
                both a continental breakfast and a Newari thali.
                {s.address ? <> · {s.address}</> : null}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/#rooms">
                  <Button size="lg" className="gap-2 bg-primary-foreground text-foreground hover:bg-primary-foreground/90">
                    Browse rooms
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/#menu">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    See the menu
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-12 max-w-4xl md:mt-16">
              <HeroSearch />
            </div>
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <section className="border-b border-border/60 bg-card">
          <div className="container grid grid-cols-2 gap-6 py-10 md:grid-cols-4 md:py-14">
            <Stat label="Room types" value={String(rooms.length)} />
            <Stat
              label="Starting from"
              value={minPrice ? `${currency} ${minPrice.toLocaleString()}` : "—"}
              sub="per night"
            />
            {google.rating !== null ? (
              <Stat
                label="Google rating"
                value={`★ ${google.rating.toFixed(1)}`}
                sub={
                  google.ratingCount
                    ? `${google.ratingCount.toLocaleString()} guests`
                    : undefined
                }
              />
            ) : (
              <Stat label="Amenities" value={String(amenities.length)} />
            )}
            <Stat label="Verification" value="Email OTP" sub="no account needed" />
          </div>
        </section>

        {/* ── Rooms teaser ─────────────────────────────────────────────── */}
        {featured.length > 0 && (
          <section
            id="rooms"
            aria-label="Rooms"
            className="container py-20 scroll-mt-20 md:py-28"
          >
            <div className="mb-10 max-w-2xl md:mb-14">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
                Stay
              </p>
              <h2 className="font-display text-3xl font-semibold md:text-5xl">
                Rooms for the trip you&apos;re taking
              </h2>
              <p className="mt-4 text-muted-foreground">
                Pick a room to see availability and book. Prices are nightly
                base rate; tax and service are added at checkout.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {featured.map((r) => (
                <RoomCard key={r.id} room={r} currency={currency} />
              ))}
            </div>

            {rooms.length > featured.length && (
              <div className="mt-10 text-center md:mt-14">
                <Link
                  href="/rooms"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  View all {rooms.length} rooms
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ── Amenities band ───────────────────────────────────────────── */}
        {amenities.length > 0 && (
          <section className="container py-20 md:py-24">
            <div className="mb-10 max-w-2xl">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
                In every stay
              </p>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">
                Quiet luxuries, on the house
              </h2>
            </div>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {amenities.map((a) => {
                const Icon = (a.icon && AMENITY_ICONS[a.icon]) || Sparkles;
                return (
                  <li
                    key={a.name}
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium">{a.name}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Menu teaser ──────────────────────────────────────────────── */}
        {menuItems.length > 0 && (
          <section
            id="menu"
            aria-label="Menu"
            className="bg-linen scroll-mt-20"
          >
            <div className="container py-20 md:py-28">
              <div className="mb-12 max-w-2xl">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
                  From our kitchen
                </p>
                <h2 className="font-display text-3xl font-semibold md:text-5xl">
                  What we cook
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Continental, Newari, and a kitchen that quietly nails both.
                  Browse only — order at the restaurant when you arrive.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                {menuItems.map((item) => (
                  <article
                    key={item.id}
                    className="flex gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-lg"
                  >
                    {item.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-24 w-24 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-accent/10">
                        <Utensils className="h-6 w-6 text-foreground/30" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-accent">
                        {item.category}
                      </p>
                      <div className="mt-1 flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-base font-semibold">
                          {item.name}
                        </h3>
                        <p className="whitespace-nowrap text-sm font-medium">
                          {currency} {Number(item.price).toLocaleString()}
                        </p>
                      </div>
                      {item.description && (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-10 text-center md:mt-12">
                <Link
                  href="/menu"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  See the full menu
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Gallery teaser ───────────────────────────────────────────── */}
        {galleryStrip.length > 0 && (
          <section
            id="gallery"
            aria-label="Gallery"
            className="bg-card border-y border-border/60 scroll-mt-20"
          >
            <div className="container py-20 md:py-24">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
                    The property
                  </p>
                  <h2 className="font-display text-3xl font-semibold md:text-4xl">
                    A look inside
                  </h2>
                </div>
              </div>
              <GalleryTeaser items={galleryStrip} />

              {gallery.length > galleryStrip.length && (
                <div className="mt-10 text-center md:mt-12">
                  <Link
                    href="/gallery"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent/5"
                  >
                    See all {gallery.length} photos
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Reviews ──────────────────────────────────────────────────── */}
        {(google.rating !== null || sliderReviews.length > 0) && (
          <section
            id="reviews"
            aria-label="Guest reviews"
            className="container py-20 md:py-24 scroll-mt-24"
          >
            <div className="mb-14 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              {google.rating !== null ? (
                <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                  <span className="text-foreground">
                    {google.rating.toFixed(1)} on Google
                  </span>
                  {google.ratingCount !== null && (
                    <>
                      <span aria-hidden className="text-muted-foreground/40">·</span>
                      <span>
                        {google.ratingCount.toLocaleString()}{" "}
                        {google.ratingCount === 1 ? "guest" : "guests"}
                      </span>
                    </>
                  )}
                </p>
              ) : (
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  From our guests
                </p>
              )}
              {google.reviewsUri && (
                <a
                  href={google.reviewsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-opacity hover:opacity-80"
                >
                  Read all on Google
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {sliderReviews.length > 0 && (
              <div className="grid gap-12 md:grid-cols-3 md:gap-10 lg:gap-14">
                {sliderReviews.slice(0, 3).map((q) => (
                  <figure key={q.id} className="flex flex-col">
                    <span
                      aria-hidden
                      className="font-display text-6xl leading-none text-accent"
                    >
                      &ldquo;
                    </span>
                    <blockquote className="mt-3 flex-1 text-lg leading-relaxed text-foreground">
                      {q.body}
                    </blockquote>
                    <figcaption className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      — {q.author_name}
                      {q.author_role && (
                        <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
                          · {q.author_role.toLowerCase()}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── FAQs ─────────────────────────────────────────────────────── */}
        {faqs.length > 0 && (
          <section className="container py-20 md:py-28">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-accent">
                  Before you book
                </p>
                <h2 className="font-display text-3xl font-semibold md:text-4xl">
                  Questions, answered.
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Anything else? Reception is online — start a chat from any page.
                </p>
              </div>
              <div className="lg:col-span-8">
                <div className="space-y-3">
                  {faqs.map((f) => (
                    <details
                      key={f.id}
                      className="group rounded-xl border border-border/60 bg-card p-5 transition-shadow open:shadow-soft"
                    >
                      <summary className="cursor-pointer select-none text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-3">
                          {f.question}
                          <span
                            aria-hidden
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-card text-sm text-muted-foreground transition-transform group-open:rotate-45"
                          >
                            +
                          </span>
                        </span>
                      </summary>
                      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {f.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="container pb-24 md:pb-32">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-primary-foreground shadow-soft-lg md:px-16 md:py-24">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
            <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative grid items-center gap-8 md:grid-cols-12">
              <div className="md:col-span-8">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
                  Ready when you are
                </p>
                <h2 className="font-display text-3xl font-semibold leading-tight md:text-5xl">
                  Pick a room. Get a code. You&apos;re booked.
                </h2>
                <p className="mt-4 max-w-xl text-primary-foreground/80">
                  Book direct for the best available rate and complimentary
                  airport pickup. No account, no password — just an email code.
                </p>
              </div>
              <div className="md:col-span-4 md:text-right">
                <Link href="/#rooms">
                  <Button size="lg" variant="accent" className="gap-2">
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold md:text-3xl">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RoomCard({ room, currency }: { room: RoomType; currency: string }) {
  const hero = room.images?.[0];
  return (
    <Link
      href={`/rooms/${room.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-1 hover:shadow-soft-lg"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        {hero ? (
          <Image
            src={hero}
            alt={`${room.name} room at Hotel Vardani, Gaushala`}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            {room.name}
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full bg-card/95 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
          Sleeps {room.max_guests}
        </div>
        <div className="absolute right-4 top-4 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur">
          {currency} {room.base_price.toLocaleString()}
          <span className="font-normal text-primary-foreground/80"> / night</span>
        </div>
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl font-semibold tracking-tight">
          {room.name}
        </h3>
        {room.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {room.description}
          </p>
        )}
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors group-hover:text-accent">
          View room
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
