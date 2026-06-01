import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { NavLink } from "./nav-link";
import { MobileNav } from "./mobile-nav";
import { User } from "lucide-react";

const NAV = [
  { href: "/#rooms", label: "Rooms" },
  { href: "/#menu", label: "Menu" },
  { href: "/#gallery", label: "Gallery" },
  { href: "/#reviews", label: "Reviews" },
];

export async function SiteHeader() {
  const supabase = await createServerClient();
  const [{ data: settings }, { data: auth }] = await Promise.all([
    supabase.from("site_settings").select("hotel_name").single(),
    supabase.auth.getUser(),
  ]);
  const hotelName = (settings?.hotel_name as string) ?? "Hotel";

  // Show My bookings unconditionally in the mobile drawer — the page itself
  // handles auth (anonymous users get bounced to /login). Suppress only the
  // header pill when signed-out so the header stays clean.
  const showMyBookingsPill = Boolean(auth.user);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-accent"
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            {hotelName}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} variant="public">
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {showMyBookingsPill && (
            <Link
              href="/my-bookings"
              aria-label="My bookings"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-sm font-medium hover:border-accent/40 hover:text-foreground md:px-3"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">My bookings</span>
            </Link>
          )}
          <Link
            href="/#rooms"
            className="inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:bg-primary/90 sm:px-4"
          >
            Book a room
          </Link>
          <MobileNav hotelName={hotelName} />
        </div>
      </div>
    </header>
  );
}
