import { ConciergeBell } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number | null;
  image_url: string | null;
};

export default async function PublicServicesPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, description, category, price, image_url")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");
  const rows = (data as ServiceRow[] | null) ?? [];

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
          eyebrow="On request"
          title="Services"
          description="Add these to your stay. Request from your booking page once you're checked in."
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={ConciergeBell}
            title="No services listed yet"
            description="Services will appear here once they're added in the dashboard."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((s) => (
              <article
                key={s.id}
                className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft transition-shadow hover:shadow-soft-lg"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {s.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/15">
                      <ConciergeBell className="h-10 w-10 text-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-accent">
                    {s.category}
                  </p>
                  <h3 className="font-display text-lg font-semibold">{s.name}</h3>
                  {s.description && (
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  )}
                  {s.price !== null && (
                    <p className="pt-1 text-sm font-semibold">
                      {symbol} {Number(s.price).toLocaleString()}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
