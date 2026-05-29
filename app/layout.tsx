import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { createServerClient } from "@/lib/supabase/server";

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

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name, tagline")
    .single();

  const name = settings?.hotel_name ?? "Hotel Management System";
  const tagline = settings?.tagline ?? undefined;

  return {
    title: { default: name, template: `%s | ${name}` },
    description: tagline,
  };
}

export default function RootLayout({
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
