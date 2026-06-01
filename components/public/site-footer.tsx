import Link from "next/link";
import { Facebook } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";

// Hotel social presence. Kept inline (vs CMS-managed) because these change
// rarely; promote to site_settings columns if/when more handles appear.
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
      <div className="container flex flex-col gap-3 py-10 md:flex-row md:items-center md:justify-between md:py-8">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="font-display text-base font-semibold">
            {s.hotel_name ?? "Hotel"}
          </span>
          {s.address && (
            <span className="ml-2 text-sm text-muted-foreground">· {s.address}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {s.contact_phone && <span>{s.contact_phone}</span>}
          {s.contact_email && <span>· {s.contact_email}</span>}
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
