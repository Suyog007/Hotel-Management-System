"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { refreshGoogleReviewsCache } from "@/lib/google-places";

export async function refreshReviewsNow() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/admin/reviews");
  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  if ((actor as { role?: string } | null)?.role !== "super_admin") {
    redirect("/?error=Super+admin+only");
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("site_settings")
    .select("google_place_id")
    .single();
  const placeId = (settings as { google_place_id?: string | null } | null)?.google_place_id;
  if (!placeId) {
    redirect(`/admin/reviews?error=${encodeURIComponent("Set a Google Place ID in /admin/settings first")}`);
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    redirect(`/admin/reviews?error=${encodeURIComponent("GOOGLE_PLACES_API_KEY env var is not set")}`);
  }

  let result;
  try {
    result = await refreshGoogleReviewsCache(placeId, apiKey, admin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    redirect(`/admin/reviews?error=${encodeURIComponent(msg)}`);
  }

  await writeAudit({
    action: "update",
    entityType: "google_reviews_cache",
    entityId: placeId,
    newValues: { ...result, manual: true },
  });
  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  redirect(
    `/admin/reviews?saved=1&inserted=${result.inserted}&updated=${result.updated}`,
  );
}
