-- Hotel Management System — initial schema
-- Phase 1 / Foundation
-- All text columns are English-only (multi-language deferred per BUILD_PLAN.md).

set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
create type user_role as enum ('guest', 'receptionist', 'manager', 'super_admin');
create type room_status as enum ('available', 'occupied', 'maintenance', 'cleaning');
create type booking_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
create type payment_status as enum ('unpaid', 'paid', 'partially_refunded', 'refunded', 'failed');
create type payment_method as enum ('online', 'pay_at_hotel');
create type payment_provider as enum ('khalti', 'esewa', 'cash');
create type verification_method as enum ('otp', 'staff_call');
create type otp_purpose as enum ('booking', 'staff_login');
create type section_type as enum ('hero', 'text', 'gallery', 'cta', 'faq');
create type service_category as enum ('spa', 'laundry', 'transport', 'food', 'other');
create type service_request_status as enum ('requested', 'scheduled', 'in_progress', 'completed', 'cancelled');
create type conversation_status as enum ('open', 'closed');

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles (decoupled from auth.users so walk-in stubs are possible)
-- auth_user_id is NULL for stub guests created by staff.
-- ─────────────────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  role user_role not null default 'guest',
  avatar_url text,
  locale text default 'en',
  is_active boolean not null default true,
  is_stub boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on profiles (lower(email));
create index profiles_auth_user_idx on profiles (auth_user_id);
create index profiles_role_idx on profiles (role);
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Auto-create profile when an auth user appears (links by email if a stub exists).
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Catalog: room_types, rooms
-- ─────────────────────────────────────────────────────────────────────────────
create table room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12,2) not null check (base_price >= 0),
  max_guests int not null check (max_guests > 0),
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger room_types_set_updated_at before update on room_types
  for each row execute function set_updated_at();

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  type_id uuid not null references room_types(id) on delete restrict,
  floor int,
  status room_status not null default 'available',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_type_idx on rooms (type_id);
create index rooms_status_idx on rooms (status);
create trigger rooms_set_updated_at before update on rooms
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- bookings (snapshots price on insert, generated nights column)
-- ─────────────────────────────────────────────────────────────────────────────
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  guest_id uuid references profiles(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  room_id uuid not null references rooms(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guests_count int not null check (guests_count > 0),
  nights int generated always as ((check_out - check_in)) stored,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  service_amount numeric(12,2) not null default 0 check (service_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status booking_status not null default 'pending',
  payment_status payment_status not null default 'unpaid',
  payment_method payment_method not null,
  verification_method verification_method not null,
  verified_by uuid references profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id) on delete set null,
  cancellation_reason text,
  refund_amount_due numeric(12,2),
  refunded_amount numeric(12,2),
  refund_reference text,
  refunded_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  special_requests text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates_valid check (check_out > check_in)
);
create index bookings_guest_idx on bookings (guest_id);
create index bookings_room_idx on bookings (room_id);
create index bookings_dates_idx on bookings (check_in, check_out);
create index bookings_status_idx on bookings (status);
create index bookings_email_idx on bookings (lower(guest_email));
create trigger bookings_set_updated_at before update on bookings
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- payments
-- ─────────────────────────────────────────────────────────────────────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method payment_method not null,
  provider payment_provider not null,
  transaction_id text,
  provider_payload jsonb,
  status payment_status not null default 'unpaid',
  initiated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on payments (booking_id);
create index payments_txn_idx on payments (transaction_id);
create trigger payments_set_updated_at before update on payments
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- OTP verifications (email-only OTP — phone is NOT a delivery channel here)
-- ─────────────────────────────────────────────────────────────────────────────
create table otp_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  purpose otp_purpose not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index otp_active_idx on otp_verifications (lower(email), purpose)
  where consumed_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Public catalog: food_items, services, service_requests
-- ─────────────────────────────────────────────────────────────────────────────
create table food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  category text not null,
  image_url text,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger food_items_set_updated_at before update on food_items
  for each row execute function set_updated_at();

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category service_category not null default 'other',
  price numeric(12,2),
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_set_updated_at before update on services
  for each row execute function set_updated_at();

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  scheduled_at timestamptz,
  notes text,
  status service_request_status not null default 'requested',
  handled_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_requests_booking_idx on service_requests (booking_id);
create index service_requests_status_idx on service_requests (status);
create trigger service_requests_set_updated_at before update on service_requests
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Google Reviews cache (writes by cron only; public reads)
-- ─────────────────────────────────────────────────────────────────────────────
create table google_reviews_cache (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  author_name text not null,
  author_photo_url text,
  rating int not null check (rating between 1 and 5),
  comment text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  raw jsonb
);
create index google_reviews_published_idx on google_reviews_cache (published_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Chat (guest ↔ reception)
-- ─────────────────────────────────────────────────────────────────────────────
create table conversations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references profiles(id) on delete cascade,
  status conversation_status not null default 'open',
  last_message_at timestamptz,
  guest_unread_count int not null default 0,
  staff_unread_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id)
);
create trigger conversations_set_updated_at before update on conversations
  for each row execute function set_updated_at();

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  sender_role user_role not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at desc);

-- Bump conversation.last_message_at + unread counters on each new message.
create or replace function on_new_message() returns trigger language plpgsql as $$
begin
  update conversations
     set last_message_at    = new.created_at,
         guest_unread_count = case
           when new.sender_role <> 'guest' then guest_unread_count + 1
           else guest_unread_count end,
         staff_unread_count = case
           when new.sender_role = 'guest' then staff_unread_count + 1
           else staff_unread_count end,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_after_insert
  after insert on messages
  for each row execute function on_new_message();

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications (in-app)
-- ─────────────────────────────────────────────────────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  type text not null,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read_at, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- CMS: site_settings, branding (both singletons)
-- ─────────────────────────────────────────────────────────────────────────────
create table site_settings (
  id boolean primary key default true check (id = true),
  hotel_name text not null default 'Grand Stay Hotel',
  tagline text,
  logo_url text,
  favicon_url text,
  address text,
  contact_phone text,
  contact_email text,
  social_links jsonb not null default '{}',
  business_hours jsonb not null default '{}',
  currency text not null default 'NPR',
  currency_symbol text not null default 'Rs.',
  timezone text not null default 'Asia/Kathmandu',
  tax_rate numeric(5,4) not null default 0.13 check (tax_rate >= 0 and tax_rate < 1),
  service_charge_rate numeric(5,4) not null default 0.10 check (service_charge_rate >= 0 and service_charge_rate < 1),
  google_place_id text,
  updated_at timestamptz not null default now()
);
create trigger site_settings_set_updated_at before update on site_settings
  for each row execute function set_updated_at();

create table branding (
  id boolean primary key default true check (id = true),
  primary_color text not null default '#1e3c72',
  secondary_color text not null default '#2a5298',
  accent_color text not null default '#f59e0b',
  font_family text not null default 'Inter, system-ui, sans-serif',
  updated_at timestamptz not null default now()
);
create trigger branding_set_updated_at before update on branding
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- CMS: pages, page_sections, gallery, amenities, faqs, testimonials
-- ─────────────────────────────────────────────────────────────────────────────
create table pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_title text,
  meta_description text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pages_set_updated_at before update on pages
  for each row execute function set_updated_at();

create table page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  section_type section_type not null,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index page_sections_page_idx on page_sections (page_id, sort_order);
create trigger page_sections_set_updated_at before update on page_sections
  for each row execute function set_updated_at();

create table gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  category text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gallery_images_set_updated_at before update on gallery_images
  for each row execute function set_updated_at();

create table amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  description text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger amenities_set_updated_at before update on amenities
  for each row execute function set_updated_at();

create table faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger faqs_set_updated_at before update on faqs
  for each row execute function set_updated_at();

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  body text not null,
  rating int check (rating between 1 and 5),
  image_url text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger testimonials_set_updated_at before update on testimonials
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Cancellation policy (tiered refund schedule)
-- ─────────────────────────────────────────────────────────────────────────────
create table cancellation_policy (
  id uuid primary key default gen_random_uuid(),
  hours_before_checkin int not null check (hours_before_checkin >= 0),
  refund_percentage numeric(5,2) not null check (refund_percentage between 0 and 100),
  label text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cancellation_policy_set_updated_at before update on cancellation_policy
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Editable templates + app_config + audit_logs
-- ─────────────────────────────────────────────────────────────────────────────
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  subject text not null,
  body_html text not null,
  body_text text,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger email_templates_set_updated_at before update on email_templates
  for each row execute function set_updated_at();

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  body text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_templates_set_updated_at before update on notification_templates
  for each row execute function set_updated_at();

create table app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
create trigger app_config_set_updated_at before update on app_config
  for each row execute function set_updated_at();

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
