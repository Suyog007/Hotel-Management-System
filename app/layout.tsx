import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { createServerClient } from "@/lib/supabase/server";
import { HotelJsonLd } from "@/components/seo/json-ld";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000";

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
    alternates: { canonical: "/" },
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
      className={`${inter.variable} ${playfair.variable}`}
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
