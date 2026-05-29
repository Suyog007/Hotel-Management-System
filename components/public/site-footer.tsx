import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export async function SiteFooter() {
  const supabase = await createServerClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name, address, contact_phone, contact_email")
    .single();
  const s = (settings ?? {}) as {
    hotel_name?: string;
    address?: string;
    contact_phone?: string;
    contact_email?: string;
  };

  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="container grid grid-cols-1 gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-display text-lg font-semibold">
              {s.hotel_name ?? "Hotel"}
            </span>
          </div>
          {s.address && (
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">{s.address}</p>
          )}
        </div>
        <div className="text-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Explore</p>
          <ul className="space-y-2">
            <li><Link href="/rooms" className="hover:text-foreground">Rooms</Link></li>
            <li><Link href="/menu" className="hover:text-foreground">Menu</Link></li>
            <li><Link href="/services" className="hover:text-foreground">Services</Link></li>
            <li><Link href="/#reviews" className="hover:text-foreground">Reviews</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</p>
          <ul className="space-y-2 text-muted-foreground">
            {s.contact_phone && <li>{s.contact_phone}</li>}
            {s.contact_email && <li>{s.contact_email}</li>}
            <li><Link href="/chat" className="hover:text-foreground">Chat with reception</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">Contact us</Link></li>
            <li><Link href="/about" className="hover:text-foreground">About</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">Terms & policies</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {s.hotel_name ?? "Hotel"}. All rights reserved.</span>
          <Link href="/login" className="hover:text-foreground">
            Staff sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
