-- Booking concurrency safety + guest insert policy.
-- Refreshes handle_new_auth_user to forward `phone` from raw_user_meta_data
-- (booking flow passes the guest's phone there).

set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- No two active bookings can overlap dates on the same room.
-- daterange '[)' = inclusive of check_in, exclusive of check_out — adjacent
-- bookings (one ends 2026-05-26, next starts 2026-05-26) are allowed.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists btree_gist;

alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('pending', 'confirmed', 'checked_in'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Guest-owner insert policy (paired with staff write policy from 0002).
-- A guest may insert a booking only for themselves, and only when verified
-- via OTP (the booking finalize action sets this after Supabase verifyOtp).
-- ─────────────────────────────────────────────────────────────────────────────
create policy "bookings owner insert" on bookings for insert
  with check (
    guest_id = current_profile_id()
    and verification_method = 'otp'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Refresh handle_new_auth_user to also persist phone from user metadata.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function handle_new_auth_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  existing_id uuid;
begin
  select id into existing_id from profiles
    where lower(email) = lower(new.email) and auth_user_id is null
    limit 1;

  if existing_id is not null then
    update profiles
       set auth_user_id = new.id,
           is_stub      = false,
           phone        = coalesce(new.raw_user_meta_data->>'phone', phone),
           updated_at   = now()
     where id = existing_id;
  else
    insert into profiles (auth_user_id, full_name, email, phone, role, is_stub)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data->>'phone',
      'guest',
      false
    );
  end if;
  return new;
end;
$$;
