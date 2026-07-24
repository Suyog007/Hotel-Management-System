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
    <header className="sticky top-0 z-30 border-b border-forest-dark/60 bg-forest text-white-wash">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-rosewood-light"
          />
          <span className="font-display text-lg font-bold tracking-tight text-white-wash">
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
              className="inline-flex items-center gap-2 rounded-[2px] border border-white-wash/30 px-2.5 py-2 text-sm font-medium text-white-wash/85 transition-colors hover:border-white-wash/60 hover:text-white-wash md:px-3"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">My bookings</span>
            </Link>
          )}
          <Link
            href="/#rooms"
            className="inline-flex rounded-[2px] bg-rosewood px-3 py-2 text-sm font-semibold text-white-wash transition-colors hover:bg-rosewood-light sm:px-4"
          >
            Book a room
          </Link>
          <MobileNav hotelName={hotelName} />
        </div>
      </div>
    </header>
  );
}
