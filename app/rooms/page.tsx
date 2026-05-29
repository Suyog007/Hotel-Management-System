import Link from "next/link";
import { ArrowRight, Users, Sparkles } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type RoomTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  max_guests: number;
  amenities: string[] | null;
  images: string[] | null;
};

export default async function RoomsListPage() {
  const supabase = await createServerClient();
  const { data: types } = await supabase
    .from("room_types")
    .select("id, name, slug, description, base_price, max_guests, amenities, images")
    .eq("is_active", true)
    .order("sort_order");
  const rows = (types as RoomTypeRow[] | null) ?? [];

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-12 md:py-16">
        <PageHeader
          eyebrow="Stay with us"
          title="Our rooms"
          description="Pick a room type to see availability and book. Prices include nightly base rate; tax and service are added at checkout."
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No rooms available"
            description="Rooms will appear here once they're added in the dashboard."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((rt) => (
              <RoomCard key={rt.id} rt={rt} symbol={symbol} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function RoomCard({ rt, symbol }: { rt: RoomTypeRow; symbol: string }) {
  const cover = (rt.images ?? [])[0];
  return (
    <Link href={`/rooms/${rt.slug}`} className="group block">
      <article className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cover}
              alt={rt.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
              <span className="font-display text-3xl font-semibold text-foreground/30">
                {rt.name}
              </span>
            </div>
          )}
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-soft backdrop-blur">
            <Users className="h-3 w-3" />
            Sleeps {rt.max_guests}
          </div>
          <div className="absolute bottom-3 right-3 rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background backdrop-blur">
            {symbol} {Number(rt.base_price).toLocaleString()} <span className="opacity-70">/ night</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold leading-tight">{rt.name}</h2>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          {rt.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{rt.description}</p>
          )}
          {(rt.amenities ?? []).length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {(rt.amenities ?? []).slice(0, 4).map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {a}
                </li>
              ))}
              {(rt.amenities ?? []).length > 4 && (
                <li className="text-xs text-muted-foreground">
                  +{(rt.amenities ?? []).length - 4} more
                </li>
              )}
            </ul>
          )}
        </div>
      </article>
    </Link>
  );
}
