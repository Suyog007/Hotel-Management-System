import Link from "next/link";
import { Facebook, MapPin, Phone } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { FloatingWhatsApp } from "./floating-whatsapp";

// Hotel social + contact info. Kept inline (vs CMS-managed) because these
// change rarely; promote to site_settings columns if/when more handles appear.
const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/p/Hotel-vardani-61575513890791/",
    icon: Facebook,
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@hotelvardanipvt.ltd",
    icon: TikTokIcon,
  },
] as const;

const PHONES = [
  { label: "Mobile", display: "+977 9742529499", tel: "+9779742529499" },
  { label: "Landline", display: "01-5901317", tel: "+97715901317" },
] as const;

// wa.me number = international format without "+". Same number as mobile.
const WHATSAPP_NUMBER = "9779742529499";

// Opens Google Maps with directions panel from the user's current location to
// Hotel Vardani. The `destination_place_id` keeps Maps anchored to the right
// place even if the display name changes.
const DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=Hotel+Vardani&destination_place_id=ChIJCYr9TbcZ6zkR00tXRsiU3eE";

export async function SiteFooter() {
  const supabase = await createServerClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name, address, contact_email")
    .single();
  const s = (settings ?? {}) as {
    hotel_name?: string;
    address?: string;
    contact_email?: string;
  };

  return (
    <>
      <footer className="mt-24 border-t border-border/60 bg-card/40">
        <div className="container flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between md:py-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-display text-base font-semibold">
              {s.hotel_name ?? "Hotel"}
            </span>
            {s.address && (
              <a
                href={DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Get directions to ${s.hotel_name ?? "the hotel"}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-accent"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>{s.address}</span>
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {PHONES.map((p) => (
              <a
                key={p.tel}
                href={`tel:${p.tel}`}
                aria-label={`${p.label}: ${p.display}`}
                className="inline-flex items-center gap-1 transition-colors hover:text-accent"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden />
                <span>{p.display}</span>
              </a>
            ))}
            {s.contact_email && (
              <a
                href={`mailto:${s.contact_email}`}
                className="transition-colors hover:text-accent"
              >
                {s.contact_email}
              </a>
            )}
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.hotel_name ?? "Hotel"} on ${name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
            <span className="md:ml-2 text-xs">
              © {new Date().getFullYear()} {s.hotel_name ?? "Hotel"}
            </span>
            <Link
              href="/login"
              className="text-[11px] uppercase tracking-wider text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              Staff
            </Link>
          </div>
        </div>
      </footer>
      <FloatingWhatsApp phone={WHATSAPP_NUMBER} />
    </>
  );
}

// Lucide doesn't ship a TikTok glyph, so an inline SVG keeps the icon set
// consistent without adding a dependency.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.69A8.16 8.16 0 0 0 22 11.04v-3.45a4.78 4.78 0 0 1-2.41-.9Z" />
    </svg>
  );
}
