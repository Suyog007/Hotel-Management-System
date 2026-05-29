-- 0011_google_place_meta.sql
-- Stores the Google Places summary (rating / rating count / display name /
-- maps URL) on the site_settings singleton. The Places API (New) returns
-- these fields reliably even when its `reviews` filter is empty, so we can
-- always render a useful Reputation block on /reviews.

alter table public.site_settings
  add column if not exists google_place_name text,
  add column if not exists google_place_rating numeric(3,2),
  add column if not exists google_place_rating_count int,
  add column if not exists google_place_uri text,
  add column if not exists google_place_fetched_at timestamptz;
