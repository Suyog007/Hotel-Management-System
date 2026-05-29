import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<unknown>;

/**
 * Shape we cache in `google_reviews_cache`. Normalised across Places API
 * versions so the renderer doesn't care which endpoint produced it.
 */
export type GoogleReview = {
  author_name: string;
  profile_photo_url?: string;
  rating: number;
  text: string;
  time: number; // unix seconds
  relative_time_description?: string;
};

// Places API (New) response types. The endpoint is
//   GET https://places.googleapis.com/v1/places/{place_id}
// with X-Goog-Api-Key and X-Goog-FieldMask headers.
//
// Legacy Places API (the old `maps.googleapis.com/maps/api/place/details/json`)
// is being shut down — accounts created after Mar 2025 can't even enable it.
type PlacesNewReview = {
  name?: string;
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
  publishTime?: string; // ISO 8601
  relativePublishTimeDescription?: string;
};

type PlacesNewResponse = {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesNewReview[];
  error?: { code?: number; message?: string; status?: string };
};

export type PlaceSummary = {
  name: string | null;
  rating: number | null;
  ratingCount: number | null;
  uri: string | null;
};

function normalise(r: PlacesNewReview): GoogleReview | null {
  const author = r.authorAttribution?.displayName?.trim();
  const text = r.text?.text ?? r.originalText?.text ?? "";
  const rating = r.rating ?? 0;
  if (!author || !rating) return null;
  const ts = r.publishTime ? Math.floor(new Date(r.publishTime).getTime() / 1000) : 0;
  return {
    author_name: author,
    profile_photo_url: r.authorAttribution?.photoUri,
    rating,
    text,
    time: ts,
    relative_time_description: r.relativePublishTimeDescription,
  };
}

/**
 * Fetches reviews via Places API (New). Returns up to 5 most-recent reviews.
 *
 * Requires the **"Places API (New)"** to be enabled on the Google Cloud
 * project that owns the key. If the user sees REQUEST_DENIED about a legacy
 * API, that means they enabled the old one — they need to enable the new
 * one explicitly at console.cloud.google.com → APIs & Services → Library
 * → search "Places API (New)" → Enable.
 */
export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<{ summary: PlaceSummary; reviews: GoogleReview[] }> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "displayName,rating,userRatingCount,googleMapsUri,reviews",
      Accept: "application/json",
    },
  });
  const data = (await res.json().catch(() => ({}))) as PlacesNewResponse;
  if (!res.ok || data.error) {
    const err = data.error;
    const msg = err
      ? `${err.status ?? `HTTP ${err.code ?? res.status}`}: ${err.message ?? ""}`
      : `HTTP ${res.status}`;
    throw new Error(`Places API ${msg}`);
  }
  return {
    summary: {
      name: data.displayName?.text ?? null,
      rating: data.rating ?? null,
      ratingCount: data.userRatingCount ?? null,
      uri: data.googleMapsUri ?? null,
    },
    reviews: (data.reviews ?? [])
      .map(normalise)
      .filter((r): r is GoogleReview => r !== null),
  };
}

// Back-compat — older callers may still want just the reviews array.
export async function fetchPlaceReviews(
  placeId: string,
  apiKey: string,
): Promise<GoogleReview[]> {
  return (await fetchPlaceDetails(placeId, apiKey)).reviews;
}

function externalIdFor(placeId: string, r: GoogleReview): string {
  const author = r.author_name.replace(/\s+/g, "_").slice(0, 64);
  return `${placeId}:${r.time}:${author}`;
}

export async function refreshGoogleReviewsCache(
  placeId: string,
  apiKey: string,
  admin: Client,
): Promise<{ inserted: number; updated: number; summary: PlaceSummary }> {
  const { reviews, summary } = await fetchPlaceDetails(placeId, apiKey);

  // Persist the summary on the singleton site_settings row regardless of
  // whether any reviews came back — Google often filters its `reviews` array
  // to zero for small/non-English listings while still returning rating
  // and userRatingCount. The summary gives us something to render either way.
  await admin
    .from("site_settings")
    .update({
      google_place_name: summary.name,
      google_place_rating: summary.rating,
      google_place_rating_count: summary.ratingCount,
      google_place_uri: summary.uri,
      google_place_fetched_at: new Date().toISOString(),
    })
    .neq("hotel_name", "__never__"); // matches the singleton; PostgREST requires a filter

  let inserted = 0;
  let updated = 0;
  for (const r of reviews) {
    const externalId = externalIdFor(placeId, r);
    const { data: existing } = await admin
      .from("google_reviews_cache")
      .select("id")
      .eq("external_id", externalId)
      .maybeSingle();
    const payload = {
      external_id: externalId,
      author_name: r.author_name,
      author_photo_url: r.profile_photo_url ?? null,
      rating: r.rating,
      comment: r.text,
      published_at: new Date(r.time * 1000).toISOString(),
      fetched_at: new Date().toISOString(),
      raw: r as unknown as Record<string, unknown>,
    };
    if (existing) {
      await admin
        .from("google_reviews_cache")
        .update(payload)
        .eq("external_id", externalId);
      updated += 1;
    } else {
      await admin.from("google_reviews_cache").insert(payload);
      inserted += 1;
    }
  }
  return { inserted, updated, summary };
}
