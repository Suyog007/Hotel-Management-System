import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, Sparkles } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { BookingForm } from "@/components/public/booking-form";
import { RoomGallery } from "@/components/public/room-gallery";
import { GoogleRatingChip } from "@/components/public/google-rating-chip";
import { AC_ADDON_PRICE, isAcAddonEligible } from "@/lib/pricing";
import { HotelRoomJsonLd } from "@/components/seo/json-ld";
import { initiateBooking } from "./actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("room_types")
    .select("name, description, base_price, images")
    .eq("slug", slug)
    .single();
  const rt = data as
    | { name: string; description: string | null; base_price: number | string; images: string[] | null }
    | null;
  if (!rt) return { title: "Room not found" };

  const price = Number(rt.base_price).toLocaleString();
  const description = rt.description
    ? `${rt.description.slice(0, 140)}${rt.description.length > 140 ? "…" : ""} From Rs. ${price}/night at Hotel Vardani, Gaushala.`
    : `${rt.name} at Hotel Vardani in Gaushala, Kathmandu — 5 min walk to Pashupatinath. From Rs. ${price}/night.`;
  const cover = (rt.images ?? [])[0];

  return {
    title: rt.name,
    description,
    alternates: { canonical: `/rooms/${slug}` },
    openGraph: {
      title: `${rt.name} — Hotel Vardani`,
      description,
      url: `${SITE_URL}/rooms/${slug}`,
      type: "website",
      images: cover ? [{ url: cover, width: 1200, height: 630, alt: rt.name }] : [],
    },
  };
}

type RoomTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  max_guests: number;
  amenities: string[] | null;
  images: string[] | null;
  is_active: boolean;
};

export default async function RoomDetailPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    error?: string;
    check_in?: string;
    check_out?: string;
    guests?: string;
  }>;
}) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  const initialGuests = sp.guests ? parseInt(sp.guests, 10) || 1 : undefined;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("room_types")
    .select("*")
    .eq("slug", slug)
    .single();
  const rt = data as RoomTypeRow | null;
  if (!rt || !rt.is_active) notFound();

  const { data: settings } = await supabase
    .from("site_settings")
    .select(
      "currency_symbol, tax_rate, service_charge_rate, google_place_rating, google_place_rating_count, google_place_uri",
    )
    .single();
  const s = (settings ?? {}) as {
    currency_symbol?: string;
    tax_rate?: number;
    service_charge_rate?: number;
    google_place_rating?: number | null;
    google_place_rating_count?: number | null;
    google_place_uri?: string | null;
  };
  const symbol = s.currency_symbol ?? "Rs.";
  const taxRate = Number(s.tax_rate ?? 0);
  const serviceRate = Number(s.service_charge_rate ?? 0);
  const google = {
    rating: s.google_place_rating ? Number(s.google_place_rating) : null,
    ratingCount: s.google_place_rating_count ?? null,
    uri: s.google_place_uri ?? null,
  };

  const images = rt.images ?? [];

  return (
    <>
      <HotelRoomJsonLd
        name={rt.name}
        description={rt.description}
        url={`${SITE_URL}/rooms/${rt.slug}`}
        basePrice={Number(rt.base_price)}
        currency="NPR"
        maxGuests={rt.max_guests}
        amenities={rt.amenities ?? []}
        images={images}
      />
      <SiteHeader />
      <main id="main" className="container py-8 md:py-12">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All rooms
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <RoomGallery name={rt.name} images={images} />

            <header>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="font-display text-display-lg font-semibold tracking-tight">
                  {rt.name}
                </h1>
                <GoogleRatingChip summary={google} />
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-3 text-base">
                <span className="font-semibold">
                  {symbol} {Number(rt.base_price).toLocaleString()}
                  <span className="font-normal text-muted-foreground"> / night</span>
                </span>
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Sleeps {rt.max_guests}
                </span>
              </p>
            </header>

            {rt.description && (
              <section>
                <h2 className="mb-3 font-display text-xl font-semibold">About this room</h2>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {rt.description}
                </p>
              </section>
            )}

            {(rt.amenities ?? []).length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-xl font-semibold">In this room</h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(rt.amenities ?? []).map((a) => (
                    <li
                      key={a}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      {a}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside>
            <Card className="lg:sticky lg:top-24">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reserve
                </p>
                <CardTitle className="font-display text-2xl">Book this room</CardTitle>
              </CardHeader>
              <CardContent>
                {sp.error && (
                  <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {sp.error}
                  </div>
                )}
                <BookingForm
                  slug={slug}
                  roomTypeId={rt.id}
                  basePrice={Number(rt.base_price)}
                  maxGuests={rt.max_guests}
                  taxRate={taxRate}
                  serviceRate={serviceRate}
                  currencySymbol={symbol}
                  acAddonPrice={isAcAddonEligible(rt.slug) ? AC_ADDON_PRICE : 0}
                  action={initiateBooking}
                  initialCheckIn={sp.check_in}
                  initialCheckOut={sp.check_out}
                  initialGuests={initialGuests}
                />
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

