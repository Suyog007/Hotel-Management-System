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
