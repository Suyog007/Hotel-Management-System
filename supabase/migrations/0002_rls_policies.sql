-- Hotel Management System — RLS policies
-- Phase 1 / Foundation
-- Convention: SECURITY DEFINER helpers read profiles by auth.uid().
-- Service-role connections bypass RLS automatically — used for webhooks,
-- OTP issuance, cron jobs, and admin invitations.

set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function current_profile_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function current_user_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() in ('receptionist', 'manager', 'super_admin'), false);
$$;

create or replace function is_manager_or_above() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() in ('manager', 'super_admin'), false);
$$;

create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() = 'super_admin', false);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on every table
-- ─────────────────────────────────────────────────────────────────────────────
alter table profiles               enable row level security;
alter table room_types             enable row level security;
alter table rooms                  enable row level security;
alter table bookings               enable row level security;
alter table payments               enable row level security;
alter table otp_verifications      enable row level security;
alter table food_items             enable row level security;
alter table services               enable row level security;
alter table service_requests       enable row level security;
alter table google_reviews_cache   enable row level security;
alter table conversations          enable row level security;
alter table messages               enable row level security;
alter table notifications          enable row level security;
alter table site_settings          enable row level security;
alter table branding               enable row level security;
alter table pages                  enable row level security;
alter table page_sections          enable row level security;
alter table gallery_images         enable row level security;
alter table amenities              enable row level security;
alter table faqs                   enable row level security;
alter table testimonials           enable row level security;
alter table cancellation_policy    enable row level security;
alter table email_templates        enable row level security;
alter table notification_templates enable row level security;
alter table app_config             enable row level security;
alter table audit_logs             enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
create policy "profiles self select"   on profiles for select using (auth_user_id = auth.uid());
create policy "profiles staff select"  on profiles for select using (is_staff());
create policy "profiles self update"   on profiles for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "profiles super update"  on profiles for update using (is_super_admin());
create policy "profiles super insert"  on profiles for insert with check (is_super_admin());
-- DELETE is intentionally not granted; deactivate via is_active instead.

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog (public read, manager+ write)
-- ─────────────────────────────────────────────────────────────────────────────
create policy "room_types public read" on room_types for select using (true);
create policy "room_types mgr write"   on room_types for all
  using (is_manager_or_above()) with check (is_manager_or_above());

create policy "rooms public read"      on rooms for select using (true);
create policy "rooms mgr write"        on rooms for all
  using (is_manager_or_above()) with check (is_manager_or_above());

create policy "food_items public read" on food_items for select using (true);
create policy "food_items mgr write"   on food_items for all
  using (is_manager_or_above()) with check (is_manager_or_above());

create policy "services public read"   on services for select using (true);
create policy "services mgr write"     on services for all
  using (is_manager_or_above()) with check (is_manager_or_above());

create policy "cancellation_policy public read" on cancellation_policy for select using (true);
create policy "cancellation_policy mgr write"   on cancellation_policy for all
  using (is_manager_or_above()) with check (is_manager_or_above());

-- ─────────────────────────────────────────────────────────────────────────────
-- bookings & payments (guest sees own; staff sees all)
-- Guest-initiated INSERT goes through a server action using service role,
-- so no anon-INSERT policy is granted here.
-- ─────────────────────────────────────────────────────────────────────────────
create policy "bookings owner read" on bookings for select
  using (guest_id = current_profile_id());
create policy "bookings staff read" on bookings for select using (is_staff());
create policy "bookings staff write" on bookings for all
  using (is_staff()) with check (is_staff());

create policy "payments owner read" on payments for select
  using (exists (
    select 1 from bookings b
     where b.id = payments.booking_id and b.guest_id = current_profile_id()
  ));
create policy "payments staff read"  on payments for select using (is_staff());
create policy "payments staff write" on payments for all
  using (is_staff()) with check (is_staff());

-- ─────────────────────────────────────────────────────────────────────────────
-- otp_verifications — service-role only (no anon policies)
-- ─────────────────────────────────────────────────────────────────────────────
-- (RLS is enabled; absence of policies means anon/auth can't read or write.)

-- ─────────────────────────────────────────────────────────────────────────────
-- service_requests
-- ─────────────────────────────────────────────────────────────────────────────
create policy "service_requests owner read" on service_requests for select
  using (exists (
    select 1 from bookings b
     where b.id = service_requests.booking_id and b.guest_id = current_profile_id()
  ));
create policy "service_requests owner insert" on service_requests for insert with check (
  exists (
    select 1 from bookings b
     where b.id = service_requests.booking_id and b.guest_id = current_profile_id()
  )
);
create policy "service_requests staff all" on service_requests for all
  using (is_staff()) with check (is_staff());

-- ─────────────────────────────────────────────────────────────────────────────
-- google_reviews_cache — public read, service-role-only write
-- ─────────────────────────────────────────────────────────────────────────────
create policy "google_reviews public read" on google_reviews_cache for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- conversations & messages
-- ─────────────────────────────────────────────────────────────────────────────
create policy "conversations owner read" on conversations for select
  using (guest_id = current_profile_id());
create policy "conversations staff read" on conversations for select using (is_staff());
create policy "conversations owner update" on conversations for update
  using (guest_id = current_profile_id()) with check (guest_id = current_profile_id());
create policy "conversations staff update" on conversations for update
  using (is_staff()) with check (is_staff());
create policy "conversations owner insert" on conversations for insert
  with check (guest_id = current_profile_id());

create policy "messages owner read" on messages for select
  using (exists (
    select 1 from conversations c
     where c.id = messages.conversation_id and c.guest_id = current_profile_id()
  ));
create policy "messages staff read" on messages for select using (is_staff());
create policy "messages owner insert" on messages for insert
  with check (
    sender_id = current_profile_id() and
    sender_role = 'guest' and
    exists (
      select 1 from conversations c
       where c.id = messages.conversation_id and c.guest_id = current_profile_id()
    )
  );
create policy "messages staff insert" on messages for insert
  with check (is_staff() and sender_id = current_profile_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications (own only)
-- ─────────────────────────────────────────────────────────────────────────────
create policy "notifications self read"   on notifications for select using (user_id = current_profile_id());
create policy "notifications self update" on notifications for update using (user_id = current_profile_id()) with check (user_id = current_profile_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- CMS — public read, super_admin write
-- ─────────────────────────────────────────────────────────────────────────────
create policy "site_settings public read" on site_settings for select using (true);
create policy "site_settings super write" on site_settings for all
  using (is_super_admin()) with check (is_super_admin());

create policy "branding public read" on branding for select using (true);
create policy "branding super write" on branding for all
  using (is_super_admin()) with check (is_super_admin());

create policy "pages public read" on pages for select using (true);
create policy "pages super write" on pages for all
  using (is_super_admin()) with check (is_super_admin());

create policy "page_sections public read" on page_sections for select using (true);
create policy "page_sections super write" on page_sections for all
  using (is_super_admin()) with check (is_super_admin());

create policy "gallery_images public read" on gallery_images for select using (true);
create policy "gallery_images super write" on gallery_images for all
  using (is_super_admin()) with check (is_super_admin());

create policy "amenities public read" on amenities for select using (true);
create policy "amenities super write" on amenities for all
  using (is_super_admin()) with check (is_super_admin());

create policy "faqs public read" on faqs for select using (true);
create policy "faqs super write" on faqs for all
  using (is_super_admin()) with check (is_super_admin());

create policy "testimonials public read" on testimonials for select using (true);
create policy "testimonials super write" on testimonials for all
  using (is_super_admin()) with check (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Templates + app_config (server-read mostly; super_admin manages)
-- ─────────────────────────────────────────────────────────────────────────────
create policy "email_templates super read"  on email_templates for select using (is_super_admin());
create policy "email_templates super write" on email_templates for all
  using (is_super_admin()) with check (is_super_admin());

create policy "notification_templates super read"  on notification_templates for select using (is_super_admin());
create policy "notification_templates super write" on notification_templates for all
  using (is_super_admin()) with check (is_super_admin());

-- app_config: public reads (powers public-facing constraints like min_stay)
create policy "app_config public read"  on app_config for select using (true);
create policy "app_config super write"  on app_config for all
  using (is_super_admin()) with check (is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_logs — super_admin read only; writes are service-role only
-- ─────────────────────────────────────────────────────────────────────────────
create policy "audit_logs super read" on audit_logs for select using (is_super_admin());
