-- 0008_anonymous_booking.sql
-- Adds a per-booking access_token so guests who book without an account can
-- view their booking via a signed link (e.g. from the confirmation email).
-- The token is generated automatically; existing rows backfill in-place.

alter table public.bookings
  add column if not exists access_token uuid not null default gen_random_uuid();

-- Look-up index for token-based reads.
create index if not exists bookings_access_token_idx
  on public.bookings (access_token);
