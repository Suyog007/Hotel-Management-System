/**
 * The canonical, absolute base URL of the site (no trailing slash).
 *
 * Single source of truth for every place that builds an absolute URL —
 * metadata/OG tags, sitemap, robots, JSON-LD, and (critically) the booking
 * links emailed to guests. Reading `NEXT_PUBLIC_SITE_URL` directly in those
 * places risked a hostless "" fallback that produced dead links in emails.
 *
 * `NEXT_PUBLIC_SITE_URL` MUST be set in production (validated by
 * `npm run check` / scripts/check-env.mjs). The localhost fallback is a
 * dev-only convenience; in production a missing value is logged loudly.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[site-url] NEXT_PUBLIC_SITE_URL is not set in production — absolute links (emails, OG tags, sitemap) will be wrong. Set it in the deployment environment.",
    );
  }
  return "http://localhost:4000";
}
