import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

const SITE_URL = getSiteUrl();

// Same handles as components/public/site-footer.tsx — keep the two in sync.
const SOCIAL_PROFILE_URLS = [
  "https://www.facebook.com/p/Hotel-vardani-61575513890791/",
  "https://www.tiktok.com/@hotelvardanipvt.ltd",
];

type HotelLdParams = {
  hotelName: string;
  description: string;
  address: string;
  placeId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  rating: number | null;
  ratingCount: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  currencySymbol: string;
  images: string[];
  amenities: string[];
};

function buildHotelLd(p: HotelLdParams) {
  // Build a Hotel schema close to schema.org/Hotel. No geo coordinates on
  // purpose — `hasMap` carries the Google Place ID, which anchors the entity
  // to the Google Business Profile more reliably than hand-typed lat/lng.
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: p.hotelName,
    description: p.description,
    url: SITE_URL,
    sameAs: SOCIAL_PROFILE_URLS,
    address: {
      "@type": "PostalAddress",
      streetAddress: p.address,
      addressLocality: "Gaushala, Kathmandu",
      addressRegion: "Bagmati",
      postalCode: "44600",
      addressCountry: "NP",
    },
  };

  if (p.placeId) {
    base.hasMap = `https://www.google.com/maps/place/?q=place_id:${p.placeId}`;
  }

  if (p.contactPhone) base.telephone = p.contactPhone;
  if (p.contactEmail) base.email = p.contactEmail;
  if (p.images.length > 0) base.image = p.images;
  if (p.priceFrom !== null) {
    base.priceRange = p.priceTo
      ? `${p.currencySymbol} ${p.priceFrom} – ${p.currencySymbol} ${p.priceTo}`
      : `${p.currencySymbol} ${p.priceFrom}+`;
  }
  if (p.rating !== null && p.ratingCount !== null && p.ratingCount > 0) {
    base.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating.toFixed(1),
      reviewCount: p.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (p.amenities.length > 0) {
    base.amenityFeature = p.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    }));
  }

  return base;
}

// Google's site-name feature (the label shown above the URL in search
// results) reads WebSite structured data from the homepage — without it,
// results fall back to the bare domain ("hotelvardani.com"). og:site_name
// alone is not enough.
function buildWebSiteLd(hotelName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: hotelName,
    alternateName: ["Hotel Vardani", "hotelvardani.com"],
    url: SITE_URL,
  };
}

/**
 * Server component that emits Hotel + WebSite schema JSON-LD script tags.
 * Mount in the root layout so every page carries the same hotel-level
 * structured data. Google can then surface name + rating + price range in
 * search results, and the WebSite schema drives the site name shown above
 * the URL.
 */
export async function HotelJsonLd() {
  const supabase = await createServerClient();
  const [
    { data: settings },
    { data: rooms },
    { data: gallery },
    { data: amenitiesRows },
  ] = await Promise.all([
    supabase
      .from("site_settings")
      .select(
        "hotel_name, tagline, address, contact_phone, contact_email, currency_symbol, google_place_id, google_place_rating, google_place_rating_count",
      )
      .single(),
    supabase.from("room_types").select("base_price").eq("is_active", true),
    supabase
      .from("gallery_images")
      .select("image_url")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(8),
    supabase
      .from("amenities")
      .select("name")
      .eq("is_visible", true)
      .order("sort_order"),
  ]);

  const s = (settings ?? {}) as Record<string, unknown>;
  const prices =
    (rooms as Array<{ base_price: number | string }> | null)?.map((r) =>
      Number(r.base_price),
    ) ?? [];
  const sorted = [...prices].sort((a, b) => a - b);

  const hotelName = (s.hotel_name as string) ?? "Hotel Vardani";
  const ld = buildHotelLd({
    hotelName,
    description:
      (s.tagline as string) ??
      "Boutique stay in Gaushala, Kathmandu — 5 minutes from Pashupatinath and 10 minutes from Tribhuvan International Airport.",
    address:
      (s.address as string) ??
      "Gaushala, Kathmandu — 5 min walk to Pashupatinath",
    placeId: (s.google_place_id as string) ?? null,
    contactPhone: (s.contact_phone as string) ?? null,
    contactEmail: (s.contact_email as string) ?? null,
    rating: (s.google_place_rating as number) ?? null,
    ratingCount: (s.google_place_rating_count as number) ?? null,
    priceFrom: sorted[0] ?? null,
    priceTo: sorted[sorted.length - 1] ?? null,
    currencySymbol: (s.currency_symbol as string) ?? "Rs.",
    images:
      (gallery as Array<{ image_url: string }> | null)?.map(
        (g) => g.image_url,
      ) ?? [],
    amenities:
      (amenitiesRows as Array<{ name: string }> | null)?.map((a) => a.name) ??
      [],
  });

  return (
    <>
      <script
        type="application/ld+json"
        // Escape `<` so a `</script>` inside admin-editable content (hotel name,
        // tagline, amenity/room text) can't break out of the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildWebSiteLd(hotelName)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
    </>
  );
}

/**
 * FAQPage JSON-LD. Mount next to any visible FAQ list (homepage, location
 * page) so the questions are eligible for rich results. Only pass questions
 * that are actually rendered on the same page — Google penalizes mismatch.
 */
export function FaqJsonLd(props: {
  faqs: Array<{ question: string; answer: string }>;
}) {
  if (props.faqs.length === 0) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: props.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      // Escape `<` so a `</script>` inside admin-editable content can't
      // break out of the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * Per-room JSON-LD. Mount on /rooms/[slug] so each room shows up as a
 * distinct entity with its own price.
 */
export function HotelRoomJsonLd(props: {
  name: string;
  description: string | null;
  url: string;
  basePrice: number;
  currency: string;
  maxGuests: number;
  amenities: string[];
  images: string[];
}) {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HotelRoom",
    name: props.name,
    url: props.url,
    occupancy: {
      "@type": "QuantitativeValue",
      maxValue: props.maxGuests,
    },
    offers: {
      "@type": "Offer",
      price: props.basePrice,
      priceCurrency: props.currency,
      availability: "https://schema.org/InStock",
    },
  };
  if (props.description) ld.description = props.description;
  if (props.images.length > 0) ld.image = props.images;
  if (props.amenities.length > 0) {
    ld.amenityFeature = props.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    }));
  }

  return (
    <script
      type="application/ld+json"
      // Escape `<` so a `</script>` inside admin-editable content (hotel name,
      // tagline, amenity/room text) can't break out of the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
      }}
    />
  );
}
