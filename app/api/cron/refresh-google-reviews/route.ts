import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshGoogleReviewsCache } from "@/lib/google-places";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; allow
  // either that or a `?secret=` query param so manual triggers also work.
  const fromHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  const fromQuery = request.nextUrl.searchParams.get("secret");
  const secret = fromHeader || fromQuery;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("site_settings")
    .select("google_place_id")
    .single();
  const placeId = (settings as { google_place_id?: string | null } | null)?.google_place_id;
  if (!placeId) {
    return NextResponse.json(
      { error: "google_place_id not configured in site_settings" },
      { status: 400 },
    );
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY env var is not set" },
      { status: 500 },
    );
  }

  try {
    const result = await refreshGoogleReviewsCache(placeId, apiKey, admin);
    return NextResponse.json({
      ok: true,
      placeId,
      inserted: result.inserted,
      updated: result.updated,
      at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
