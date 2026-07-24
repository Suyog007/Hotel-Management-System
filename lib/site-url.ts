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
  if (raw) {
    const normalized = raw.replace(/\/+$/, "");
    // A schemeless value (e.g. "hotelvardani.com") makes `new URL(...)` throw
    // at metadataBase and every absolute link malformed — fail loudly instead.
    if (!/^https?:\/\//i.test(normalized)) {
      throw new Error(
        `[site-url] NEXT_PUBLIC_SITE_URL must include a scheme (https://…); got "${raw}".`,
      );
    }
    return normalized;
  }
  // In production a missing value silently shipped localhost URLs into emails,
  // OG tags, sitemap and JSON-LD. Fail the boot/build instead of poisoning them.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[site-url] NEXT_PUBLIC_SITE_URL is not set in production. Set it in the deployment environment (absolute links in emails, OG tags and the sitemap depend on it).",
    );
  }
  return "http://localhost:4000";
}
