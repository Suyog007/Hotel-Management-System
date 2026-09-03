-- ─────────────────────────────────────────────────────────────────────────────
-- 0017 — Reconcile notification_templates with the keys the code consumes.
--
-- The in-app alert pipeline now sends three notification types (see
-- lib/notification-types.ts, the single source of truth):
--   staff_new_booking   — fired on every online + walk-in booking
--   staff_cancellation  — fired when a booking is cancelled
--   overdue_checkout    — daily cron reminder (was previously seeded only by
--                         the hand-run scripts/seed-overdue-notification-template.mjs)
--
-- booking_confirmed / booking_cancelled were seeded in 0003 as *in-app*
-- notification templates, but guests have no in-app notification surface
-- (no account, no bell) and no code ever sent them. The same-named EMAIL
-- templates in email_templates are unaffected. Same cleanup precedent as
-- 0016 dropping chat_new_message.
--
-- Run by hand in the Supabase dashboard SQL editor (service role can't DDL,
-- and seeds ride along with migrations in this repo). Safe to run before or
-- after deploying the code: the code falls back to identical hardcoded copy
-- while a row is missing.
-- ─────────────────────────────────────────────────────────────────────────────

-- Dead guest-facing keys: nothing ever consumed them.
delete from notification_templates
where key in ('booking_confirmed', 'booking_cancelled');

-- Cron template, previously only present if the one-off seed script was run.
insert into notification_templates (key, title, body, variables) values
  (
    'overdue_checkout',
    '{{count}} overdue checkout(s)',
    'Past their check-out date and still checked in: {{rooms}}. Check them out or extend the stay from the Bookings page.',
    array['count', 'rooms']
  )
on conflict (key) do nothing;

-- New-booking alert. The 0003 seed row was dead code until now, so no admin
-- ever meaningfully edited it — overwrite with the richer copy the sender
-- actually fills.
insert into notification_templates (key, title, body, variables) values
  (
    'staff_new_booking',
    'New booking: {{guest_name}}',
    '{{room_name}}, {{check_in}} → {{check_out}} ({{booking_code}}).',
    array['guest_name', 'booking_code', 'room_name', 'check_in', 'check_out']
  )
on conflict (key) do update
  set title = excluded.title,
      body = excluded.body,
      variables = excluded.variables;

-- Cancellation alert (new key).
insert into notification_templates (key, title, body, variables) values
  (
    'staff_cancellation',
    'Cancelled: {{booking_code}}',
    '{{guest_name}} — stay starting {{check_in}}. Refund due: {{refund_amount_due}}.',
    array['guest_name', 'booking_code', 'check_in', 'refund_amount_due']
  )
on conflict (key) do nothing;
