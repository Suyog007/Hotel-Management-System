-- Hotel Management System — seed data
-- Phase 1 / Foundation
-- Idempotent: safe to re-run.

set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Singletons
-- ─────────────────────────────────────────────────────────────────────────────
insert into site_settings (id, hotel_name, tagline, currency, currency_symbol, timezone, tax_rate, service_charge_rate)
values (true, 'Grand Stay Hotel', 'A modern stay in the heart of the city.', 'NPR', 'Rs.', 'Asia/Kathmandu', 0.13, 0.10)
on conflict (id) do nothing;

insert into branding (id, primary_color, secondary_color, accent_color, font_family)
values (true, '#1e3c72', '#2a5298', '#f59e0b', 'Inter, system-ui, sans-serif')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Default cancellation tiers (matching §7.1 of architecture doc)
-- ─────────────────────────────────────────────────────────────────────────────
insert into cancellation_policy (hours_before_checkin, refund_percentage, label, sort_order)
values
  (72, 100, 'Full refund (more than 72 hours before check-in)', 1),
  (24, 50,  'Half refund (24–72 hours before check-in)',         2),
  (0,  0,   'No refund (less than 24 hours before check-in)',    3)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- App config defaults
-- ─────────────────────────────────────────────────────────────────────────────
insert into app_config (key, value, description) values
  ('otp_expiry_seconds',      '600',  'OTP validity window in seconds (default 10 min)'),
  ('otp_max_attempts',        '5',    'Max OTP verify attempts before invalidation'),
  ('min_stay_nights',         '1',    'Minimum nights per booking'),
  ('max_guests_per_booking',  '8',    'Hard cap on guests in a single booking'),
  ('guest_session_days',      '30',   'Lifetime of the signed guest cookie (days)'),
  ('staff_remember_days',     '30',   'Lifetime of the trusted-device staff cookie (days)'),
  ('reviews_refresh_hours',   '24',   'How often the Google Reviews cache cron runs')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Default page shells (home, about, contact, terms)
-- Sections are added by the super admin in Phase 2.
-- ─────────────────────────────────────────────────────────────────────────────
insert into pages (slug, title, meta_title, meta_description) values
  ('home',    'Home',    'Welcome', 'Comfortable rooms and warm hospitality.'),
  ('about',   'About',   'About Us', 'Our story and what makes us different.'),
  ('contact', 'Contact', 'Contact', 'Reach our front desk.'),
  ('terms',   'Terms',   'Terms & Policies', 'Booking, cancellation, and house rules.')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Email template stubs ({{placeholders}} replaced at send time)
-- ─────────────────────────────────────────────────────────────────────────────
insert into email_templates (key, subject, body_html, body_text, variables) values
  ('otp_login',
   'Your verification code',
   '<p>Hi {{name}},</p><p>Your verification code is <strong>{{code}}</strong>. It expires in {{minutes}} minutes.</p>',
   'Your verification code is {{code}}. Expires in {{minutes}} minutes.',
   array['name','code','minutes']),
  ('booking_confirmation',
   'Booking confirmed — {{booking_code}}',
   '<p>Hi {{guest_name}},</p><p>Your booking <strong>{{booking_code}}</strong> for {{room_name}} from {{check_in}} to {{check_out}} is confirmed.</p><p>Total: {{currency_symbol}} {{total_amount}}.</p>',
   'Booking {{booking_code}} for {{room_name}} from {{check_in}} to {{check_out}} confirmed. Total: {{currency_symbol}} {{total_amount}}.',
   array['guest_name','booking_code','room_name','check_in','check_out','total_amount','currency_symbol']),
  ('booking_cancelled',
   'Your cancellation has been received — {{booking_code}}',
   '<p>Hi {{guest_name}},</p><p>We have received your cancellation for booking <strong>{{booking_code}}</strong>. Your refund of {{currency_symbol}} {{refund_amount_due}} will be processed manually by our team.</p>',
   'Cancellation received for booking {{booking_code}}. Refund of {{currency_symbol}} {{refund_amount_due}} will be processed manually.',
   array['guest_name','booking_code','refund_amount_due','currency_symbol']),
  ('booking_refunded',
   'Refund processed — {{booking_code}}',
   '<p>Hi {{guest_name}},</p><p>Your refund of {{currency_symbol}} {{refunded_amount}} for booking <strong>{{booking_code}}</strong> has been processed. Reference: {{refund_reference}}.</p>',
   'Refund of {{currency_symbol}} {{refunded_amount}} processed for booking {{booking_code}}. Reference: {{refund_reference}}.',
   array['guest_name','booking_code','refunded_amount','refund_reference','currency_symbol']),
  ('review_request',
   'Thanks for staying with us!',
   '<p>Hi {{guest_name}},</p><p>We hope you enjoyed your stay. If you have a moment, we would love a quick <a href="{{review_url}}">Google review</a>.</p>',
   'Thanks for staying with us! Review us on Google: {{review_url}}',
   array['guest_name','review_url'])
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Notification template stubs
-- ─────────────────────────────────────────────────────────────────────────────
insert into notification_templates (key, title, body, variables) values
  ('booking_confirmed', 'Booking confirmed',  'Your booking {{booking_code}} is confirmed.',      array['booking_code']),
  ('booking_cancelled', 'Booking cancelled',  'Your booking {{booking_code}} has been cancelled.', array['booking_code']),
  ('chat_new_message',  'New message',        'You have a new message from the front desk.',     array[]::text[]),
  ('staff_new_booking', 'New booking',        'New booking {{booking_code}} for {{room_name}}.',  array['booking_code','room_name'])
on conflict (key) do nothing;
