import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { refreshReviewsNow } from "./actions";

type CachedReview = {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  comment: string | null;
  published_at: string;
  fetched_at: string;
};

export default async function AdminReviewsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string; inserted?: string; updated?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();

  const [{ data: settings }, { data: reviews, count }] = await Promise.all([
    supabase
      .from("site_settings")
      .select(
        "google_place_id, google_place_name, google_place_rating, google_place_rating_count, google_place_uri, google_place_fetched_at",
      )
      .single(),
    supabase
      .from("google_reviews_cache")
      .select("id, author_name, author_photo_url, rating, comment, published_at, fetched_at", { count: "exact" })
      .order("published_at", { ascending: false }),
  ]);
  const sx = (settings ?? {}) as {
    google_place_id?: string | null;
    google_place_name?: string | null;
    google_place_rating?: number | null;
    google_place_rating_count?: number | null;
    google_place_uri?: string | null;
    google_place_fetched_at?: string | null;
  };
  const placeId = sx.google_place_id ?? null;
  const rows = (reviews as CachedReview[] | null) ?? [];
  const lastFetched = sx.google_place_fetched_at ?? rows[0]?.fetched_at ?? null;
  const summaryRating = sx.google_place_rating ? Number(sx.google_place_rating) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Reputation"
        title="Google reviews"
        description="Reviews live on Google. The system caches the most recent few via the Places API so the public site renders them quickly."
      />

      {sp.saved && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          Refresh complete · {sp.inserted ?? "0"} new, {sp.updated ?? "0"} updated.
        </div>
      )}
      {sp.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sp.error}
        </div>
      )}

      {summaryRating !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Live summary
              {sx.google_place_uri && (
                <a
                  href={sx.google_place_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-normal text-accent underline"
                >
                  open on Google
                </a>
              )}
            </CardTitle>
            <CardDescription>
              What Google returned from the last refresh — what the public site
              uses for the headline number.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Name</p>
              <p className="mt-1 font-medium">{sx.google_place_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Rating</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {summaryRating.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / 5
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Ratings</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {(sx.google_place_rating_count ?? 0).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Set the Place ID under{" "}
            <Link href="/admin/settings" className="underline">Site settings</Link>.
            Add <code className="rounded bg-muted px-1 text-xs">GOOGLE_PLACES_API_KEY</code> to your env.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Place ID: </span>
            <span className="font-mono">{placeId ?? "(not set)"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Last refresh: </span>
            {lastFetched ? lastFetched.replace("T", " ").slice(0, 19) : "never"}
          </p>
          <p>
            <span className="text-muted-foreground">Cached reviews: </span>
            {count ?? 0}
            {summaryRating !== null && count === 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                — Google&apos;s API returned no written reviews for this listing yet.
                The public summary above still renders.
              </span>
            )}
          </p>

          <form action={refreshReviewsNow}>
            <Button type="submit">Refresh now</Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Cache preview</h2>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No cached reviews yet. Click <strong>Refresh now</strong> after configuring the Place ID.
          </p>
        )}
        <div className="space-y-3">
          {rows.slice(0, 5).map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center gap-3">
                  <Avatar name={r.author_name} src={r.author_photo_url} size={32} />
                  <div>
                    <p className="text-sm font-medium">{r.author_name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-accent">{"★".repeat(r.rating)}</span>
                      <span className="text-muted-foreground/40">{"★".repeat(5 - r.rating)}</span>
                      {" "}· {r.published_at.slice(0, 10)}
                    </p>
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
