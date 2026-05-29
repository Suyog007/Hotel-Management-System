import { UtensilsCrossed } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type FoodRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
};

export default async function PublicMenuPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("food_items")
    .select("id, name, description, price, category, image_url")
    .eq("is_available", true)
    .order("category")
    .order("sort_order");
  const rows = (data as FoodRow[] | null) ?? [];

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol, hotel_name")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";
  const hotel = (settings?.hotel_name as string) ?? "Our restaurant";

  const groups: Record<string, FoodRow[]> = {};
  for (const r of rows) {
    if (!groups[r.category]) groups[r.category] = [];
    groups[r.category].push(r);
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-12 md:py-16">
        <PageHeader
          eyebrow="From our kitchen"
          title="Menu"
          description={`Prepared by the team at ${hotel}. Browse only — orders happen at the restaurant.`}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="Menu coming soon"
            description="Check back later — the team is updating the menu."
          />
        ) : (
          <div className="space-y-12">
            {Object.entries(groups).map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight">
                  {category}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="flex gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-lg"
                    >
                      {item.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-24 w-24 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-accent/10">
                          <UtensilsCrossed className="h-6 w-6 text-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-display text-base font-semibold">
                            {item.name}
                          </h3>
                          <p className="whitespace-nowrap text-sm font-medium">
                            {symbol} {Number(item.price).toLocaleString()}
                          </p>
                        </div>
                        {item.description && (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
