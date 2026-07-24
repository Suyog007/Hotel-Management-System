import type { Metadata } from "next";
import { Bricolage_Grotesque, Karla, Space_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { createServerClient } from "@/lib/supabase/server";
import { HotelJsonLd } from "@/components/seo/json-ld";
import { getSiteUrl } from "@/lib/site-url";

// Body — warm humanist sans.
const karla = Karla({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

// Display headlines — slightly hand-cut, the brand's personality.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});

// Labels / data — ledger/reception-desk feel.
const spaceMono = Space_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
  variable: "--font-mono",
});

// Accent italic — used sparingly for one emphasized word or review quotes.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  style: ["italic"],
  variable: "--font-accent",
});

const SITE_URL = getSiteUrl();

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerClient();
  const [{ data: settings }, { data: hero }] = await Promise.all([
    supabase
      .from("site_settings")
      .select("hotel_name, tagline")
      .single(),
    supabase
      .from("gallery_images")
      .select("image_url")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle(),
  ]);

  const name = (settings?.hotel_name as string) ?? "Hotel Vardani";
  const tagline =
    (settings?.tagline as string) ??
    "Boutique stay in Gaushala, Kathmandu — 5 min walk to Pashupatinath, 10 min to the airport.";
  const ogImage = (hero?.image_url as string | undefined) ?? undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${name} — Hotel near Pashupatinath in Gaushala, Kathmandu`,
      template: `%s | ${name}`,
    },
    description: tagline,
    keywords: [
      "Hotel Vardani",
      "Gaushala hotel",
      "Pashupatinath hotel",
      "hotel near Pashupatinath",
      "hotel near airport Kathmandu",
      "family hotel Kathmandu",
      "boutique hotel Kathmandu",
      "Tribhuvan airport hotel",
    ],
    // No canonical here: `alternates` is inherited wholesale by every page
    // that doesn't set its own, which would point all of them at "/" and
    // deindex them. Each page (including the homepage) declares its own.
    openGraph: {
      title: `${name} — Hotel near Pashupatinath in Gaushala`,
      description: tagline,
      url: SITE_URL,
      siteName: name,
      type: "website",
      locale: "en_US",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: name }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: `${name} — Hotel in Gaushala, Kathmandu`,
      description: tagline,
      images: ogImage ? [ogImage] : [],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${karla.variable} ${bricolage.variable} ${spaceMono.variable} ${fraunces.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <HotelJsonLd />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground focus:shadow-soft-lg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
