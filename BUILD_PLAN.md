# Hotel Management System — Build Plan

> Source of truth for build progress. Architecture spec lives in
> `docs/hotel-system-architecture.docx.pdf`. When that doc and this file
> disagree, the doc wins — update this file.

## How to use this file

- Status markers: `[ ]` todo, `[~]` in progress, `[x]` done, `[!]` blocked.
- Each phase has a checklist. Tick boxes inline as work lands.
- Add a one-line note next to a task when it has a non-obvious decision.
- Do **not** start a later phase before the current phase's gate is met.
- "What NOT to do" is non-negotiable scope discipline — re-read before adding features.

## Stack snapshot

- **Framework:** Next.js 15 (App Router) + TypeScript
- **DB / Auth / Storage / Realtime:** Supabase (Postgres + RLS)
- **UI:** Tailwind CSS + shadcn/ui
- **Validation:** Zod (server actions + webhooks)
- **Payments:** Khalti + eSewa (Nepal) + pay-at-hotel
- **Email:** Resend (transactional + OTP)
- **Deploy:** Vercel + Supabase Pro

## What NOT to do (out of scope / explicit constraints)

Pulled from the architecture doc. Do not silently add any of these.

- **No SMS OTP.** OTP is email-only via Resend. Phone is collected for staff contact / fraud reduction only.
- **No guest signup.** Guests truly do not create accounts. The booking-OTP path issues our own 6-digit code (`lib/booking-otp.ts`), writes only a stub `profiles` row (no `auth_user_id`), and never establishes a Supabase session. The booking detail page is reachable via a per-booking `access_token` in the URL (`/booking/<id>?t=<uuid>`) — that token is the only handle a guest has. `/login` + Supabase Auth remain in place but are only for staff and super_admin.
- **No in-app food ordering.** The menu page is browse-only. `food_items` is CMS content, not a cart.
- **No in-app review writing.** Reviews live on Google. The system only caches Google Reviews via Places API for public display. No moderation UI.
- **No automatic dynamic pricing.** One `base_price` per room type. No calendar overrides, no rule engine, no weekend/holiday auto-uplifts. Admin edits the single field directly.
- **No automatic refund.** System computes recommended refund and marks the booking cancelled. Admin processes the actual refund manually outside the system (Khalti/eSewa dashboards or cash) and records `refunded_amount` + reference.
- **No multi-language at v1.** Text columns are plain English `text`. Multi-lang (JSONB or duplicated columns) is deferred until there's a clear need. Title says "EN/NE" but §1.1 says "English"; the doc explicitly says deferred.
- **No page builder.** CMS sections are predefined types (`hero | text | gallery | cta | faq`). No custom HTML/JS injection. Top-level pages limited to home, about, contact, terms.
- **No multi-property.** Single hotel. Don't add a `properties` table or scope tables by `property_id`.
- **No Stripe at v1.** Khalti + eSewa only. Stripe can be added later for foreign cards.
- **Don't move money from code.** Webhooks confirm received payments; refunds are out-of-band.
- **Don't validate at internal boundaries.** Zod runs at server-action / webhook entry points, not between trusted internal modules.
- **Don't write backwards-compat shims.** Pre-launch, no users — just change the code.

## Phase progress overview

| Phase | Scope                         | Weeks | Status |
|-------|-------------------------------|-------|--------|
| 1     | Foundation                    | 1     | `[x]`  |
| 2     | CMS Core                      | 2     | `[x]`  |
| 3     | Rooms + Booking               | 3-4   | `[x]`  |
| 4     | Cancellation (payments deferred) | 4-5 | `[x]`  |
| 5     | Staff Ops                     | 5-6   | `[x]`  |
| 6     | Add-ons (menu, services, chat, reviews) | 6-7 | `[x]` |
| 6.5   | UI redesign (boutique premium) | 7   | `[x]`  |
| 7     | Mobile + a11y polish           | 7   | `[x]`  |
| Post  | Perf, security review, deploy  | 7+    | `[ ]`  |

---

## Phase 1 — Foundation ✅ done (pending `npm install` + migration apply)

**Gate to advance:** `npm run dev` boots, middleware redirects unauthenticated `/dashboard` to `/login`, migrations apply cleanly to a fresh Supabase project, `site_settings` row exists.
Files are in place but the gate is not yet **verified** — requires running `npm install` and applying migrations against a real Supabase project. See "Verification checklist" below.

### 1.1 Repo + tooling

- [x] `package.json` with Next 15, React 19, TS, Tailwind, shadcn deps, Supabase SSR client, Zod, Resend, date-fns
- [x] `tsconfig.json` with `@/*` path alias
- [x] `next.config.ts`
- [x] `tailwind.config.ts` with shadcn theme tokens (CSS vars)
- [x] `postcss.config.mjs`
- [x] `components.json` for shadcn CLI
- [x] `.env.example` with every key the codebase reads
- [x] `.gitignore` (Next.js + .env.local + .next + node_modules)
- [x] `eslint.config.mjs` (Next 15 flat config)
- [x] `README.md` rewrite: setup, env, migrations, dev

### 1.2 App shell

- [x] `app/layout.tsx` root layout (loads branding CSS vars from DB)
- [x] `app/globals.css` with shadcn CSS variables
- [x] `app/page.tsx` placeholder homepage (reads `site_settings.hotel_name`)
- [x] `app/not-found.tsx`
- [x] `lib/utils.ts` with `cn()` helper

### 1.3 Supabase clients

- [x] `lib/supabase/client.ts` (browser client)
- [x] `lib/supabase/server.ts` (RSC / server-action client, reads cookies)
- [x] `lib/supabase/middleware.ts` (refresh session helper, returns user + role)
- [x] `lib/supabase/admin.ts` (service-role client, `server-only` import)
- [x] `types/database.ts` (loose stub; regenerate via `npm run db:types`)

### 1.4 Middleware (role gate)

- [x] `middleware.ts` at repo root
- [x] Reads Supabase session via `updateSession` helper
- [x] Gates `/dashboard/**` to staff (receptionist / manager / super_admin)
- [x] Gates `/admin/**` to super_admin only
- [x] Redirects unauthenticated staff routes to `/login?next=…`
- [x] Lets public routes through untouched

### 1.5 Database schema (SQL migrations)

`supabase/migrations/0001_initial_schema.sql`:

- [x] Enums: `user_role`, `room_status`, `booking_status`, `payment_status`, `payment_method`, `payment_provider`, `verification_method`, `otp_purpose`, `section_type`, `service_category`, `service_request_status`, `conversation_status`
- [x] **Core tables (§5.1):** `profiles`, `room_types`, `rooms`, `bookings`, `payments`, `otp_verifications` (keyed on email — OTP is email-only)
- [x] **Add-on tables (§5.2):** `food_items`, `services`, `service_requests`, `google_reviews_cache`, `conversations`, `messages`, `notifications`
- [x] **CMS tables (§5.3):** `site_settings` (singleton), `branding` (singleton), `pages`, `page_sections`, `gallery_images`, `amenities`, `faqs`, `testimonials`, `cancellation_policy`, `email_templates`, `notification_templates`, `app_config`, `audit_logs`
- [x] Indexes on hot paths: `bookings(check_in, check_out)`, `bookings(guest_id)`, `bookings(room_id)`, `rooms(type_id)`, `messages(conversation_id, created_at)`, `notifications(user_id, read_at)`
- [x] `updated_at` trigger function + triggers on all mutable tables
- [x] `profiles` decoupled from `auth.users` (auth_user_id is nullable for walk-in stubs) + `handle_new_auth_user()` trigger links new auth users to existing stubs by email
- [x] `messages` insert trigger bumps `conversations.last_message_at` + unread counters
- [x] `bookings.nights` generated column; price snapshotted onto `bookings.total_amount`

`supabase/migrations/0002_rls_policies.sql`:

- [x] Enable RLS on every table
- [x] Helpers: `current_profile_id()`, `current_user_role()`, `is_staff()`, `is_manager_or_above()`, `is_super_admin()`
- [x] Public-read policies on catalog + CMS (room_types, rooms, food_items, services, cancellation_policy, gallery, faqs, pages, page_sections, testimonials, amenities, google_reviews_cache, site_settings, branding, app_config)
- [x] Guest-self policies on `bookings`, `payments`, `service_requests`, `conversations`, `messages`, `notifications`, `profiles`
- [x] Manager+ write on catalog (rooms, room_types, food_items, services, cancellation_policy)
- [x] Super-admin-only write on CMS + templates + audit_logs read
- [x] `otp_verifications` is locked down — service role only (no anon policies)

`supabase/migrations/0003_seed_data.sql`:

- [x] `site_settings` singleton ("Grand Stay Hotel", NPR, Asia/Kathmandu, 0.13 tax, 0.10 service)
- [x] `branding` singleton with placeholder colors + Inter font
- [x] Default `cancellation_policy` tiers (>72h: 100%, 24–72h: 50%, <24h: 0%)
- [x] Default `app_config` keys (otp_expiry_seconds, otp_max_attempts, min_stay_nights, max_guests_per_booking, guest_session_days, staff_remember_days, reviews_refresh_hours)
- [x] Stub `pages` rows for home, about, contact, terms
- [x] Stub `email_templates`: otp_login, booking_confirmation, booking_cancelled, booking_refunded, review_request
- [x] Stub `notification_templates`: booking_confirmed, booking_cancelled, chat_new_message, staff_new_booking

### 1.6 Auth scaffolding (shells only — full flows are Phase 3+)

- [x] `app/(auth)/login/page.tsx` placeholder
- [x] `app/(auth)/verify-otp/page.tsx` placeholder

### 1.7 Dev / docs

- [x] `supabase/README.md` explaining how to run migrations (CLI + SQL editor paths)
- [x] `README.md`: setup, `.env.local` from `.env.example`, `npm install`, migrations, `npm run dev`

### Verification checklist (run on your machine to close the Phase 1 gate)

- [ ] `npm install` succeeds
- [ ] Create a Supabase project, fill `.env.local` from `.env.example`
- [ ] Apply migrations (CLI `supabase db push` **or** paste each SQL file in dashboard order)
- [ ] Confirm `select hotel_name from site_settings;` returns "Grand Stay Hotel"
- [ ] `npm run dev` boots, homepage renders the hotel name from the DB
- [ ] Visiting `/dashboard` while logged out redirects to `/login?next=/dashboard`
- [ ] `npm run type-check` passes
- [ ] `npm run db:types` regenerates `types/supabase.ts`; switch `types/database.ts` to re-export from it

---

## Phase 2 — CMS Core

**Gate to advance:** super admin can log in via email OTP, edit `site_settings` + `branding`, manage FAQs and amenities — and the public homepage reflects the changes without redeploy. Audit log row written for every mutation.

### 2.1 UI primitives (hand-rolled shadcn)

- [x] `components/ui/button.tsx`
- [x] `components/ui/input.tsx`
- [x] `components/ui/label.tsx`
- [x] `components/ui/textarea.tsx`
- [x] `components/ui/card.tsx`
- [x] `components/ui/switch.tsx` (native checkbox-as-switch)

### 2.2 Email + audit helpers

- [x] `lib/email.ts` — Resend wrapper (`sendEmail`, `renderTemplate`)
- [x] `lib/audit.ts` — `writeAudit({ action, entityType, entityId, oldValues, newValues })` using service-role client; auto-resolves actor from session
- [x] `lib/validation/cms.ts` — shared Zod schemas

### 2.3 Auth (email OTP via Supabase Auth)

- [x] `app/(auth)/login/page.tsx` real form (email input)
- [x] `app/(auth)/login/actions.ts` `requestOtp` server action (Zod, `shouldCreateUser=false`)
- [x] `app/(auth)/verify-otp/page.tsx` real form (6-digit code + email passthrough)
- [x] `app/(auth)/verify-otp/actions.ts` `verifyOtp` server action (Zod, role-based redirect)
- [x] `app/(auth)/logout/route.ts` POST endpoint
- Note: Supabase project must be configured to send 6-digit codes (Auth → Email Templates → Magic Link → swap to OTP) and to use Resend SMTP. Document this in the Phase 2 close-out.

### 2.4 Admin shell

- [x] `app/(admin)/admin/layout.tsx` — sidebar nav + super_admin guard (defense-in-depth; middleware already blocks non-super at the edge)
- [x] `app/(admin)/admin/page.tsx` — redirects to `/admin/settings`
- [x] `components/admin/sidebar.tsx` — nav links (Settings, Branding, FAQs, Amenities, …)

### 2.5 Settings CRUD

- [x] `/admin/settings` form (hotel_name, tagline, address, contact, currency, timezone, tax/service rates, google_place_id)
- [x] `updateSettings` server action with Zod + audit log

### 2.6 Branding CRUD

- [x] `/admin/branding` form (primary/secondary/accent colors, font_family) with live preview swatches
- [x] `updateBranding` server action with Zod + audit log

### 2.7 FAQs CRUD

- [x] `/admin/faqs` list view with create form + per-row edit/delete/toggle visible
- [x] `createFaq`, `updateFaq`, `deleteFaq`, `toggleFaqVisible` server actions

### 2.8 Amenities CRUD

- [x] `/admin/amenities` list view with create form + per-row edit/delete/toggle visible
- [x] `createAmenity`, `updateAmenity`, `deleteAmenity`, `toggleAmenityVisible` server actions

### 2.9 Storage buckets

- [x] `supabase/migrations/0004_storage_buckets.sql` — create `public-images` bucket (public-read, super-admin-write) for branding/gallery/page-section images

### 2.10 Pages + sections editor

- [x] `lib/validation/sections.ts` — Zod schemas per section type + dispatch + defaults
- [x] `/admin/pages` lists the four fixed pages
- [x] `/admin/pages/[slug]` edits page meta + manages its sections
- [x] Per-type field editor (hero / text / gallery picker / cta / faq) dispatched server-side
- [x] Create / update / delete / reorder (via `sort_order` field) actions with audit log
- [x] Public homepage (`app/page.tsx`) renders from `pages` + `page_sections` for slug='home', falls back to hotel name if no sections

### 2.11 Gallery + image upload

- [x] `lib/storage.ts` — `uploadPublicImage` / `deletePublicImageByUrl` helpers (admin client, 10 MB cap, allowlist of image MIME types)
- [x] `/admin/gallery` — upload form (file + caption + category + order + visible) and per-row edit/delete
- [x] Storage object rollback if DB insert fails after upload
- [x] Best-effort storage delete when a gallery row is removed

### 2.12 Testimonials

- [x] Added `testimonialSchema` to `lib/validation/cms.ts`
- [x] `/admin/testimonials` mirrors the FAQs pattern with rating + avatar fields

### 2.13 Templates editor

- [x] `lib/validation/templates.ts` — email + notification template schemas
- [x] `/admin/templates` lists every email and notification template; per-template inline editor for subject/body/active

### 2.14 Sidebar wiring

- [x] `components/admin/sidebar.tsx` updated with Pages, Gallery, Testimonials, Templates nav items

### Phase 2 verification checklist (run after migrations are applied)

- [ ] Bootstrap super admin per instructions in `supabase/README.md` (create user in Supabase dashboard, promote via SQL, configure email template to render `{{ .Token }}`)
- [ ] Apply migration `0004_storage_buckets.sql` (alongside 0001–0003)
- [ ] `npm install` and `npm run dev`
- [ ] Hit `/admin` while logged out → redirected to `/login?next=/admin`
- [ ] Sign in with super admin email; receive 6-digit code; verify; land on `/admin/settings`
- [ ] Edit `Hotel name` on `/admin/settings`, save, then refresh the public homepage and confirm it updated
- [ ] Edit a brand color on `/admin/branding`, save; the next page render reflects the new CSS var
- [ ] Create / edit / delete a row on `/admin/faqs` and `/admin/amenities`
- [ ] On `/admin/pages/home` add a hero section, save, visit `/` — hero renders with the branding colors
- [ ] On `/admin/pages/home` add a gallery section (after uploading an image on `/admin/gallery`); picker shows the image, save, visit `/` — gallery renders
- [ ] Upload an image on `/admin/gallery`, edit its caption, then delete it — verify the row disappears and the storage object is gone in the Supabase dashboard
- [ ] Edit a testimonial on `/admin/testimonials` and an email template on `/admin/templates`
- [ ] Sign out via the sidebar button → redirected to home, session cleared
- [ ] In the Supabase dashboard, confirm `audit_logs` has rows for each mutation (action, entity_type, actor_email, old/new values)

## Phase 3 — Rooms + Booking

**Gate to advance:** A guest visits `/rooms`, picks a room type, fills the booking form, receives an email OTP, verifies, and lands on a booking confirmation page. A manager can edit room types and rooms from the staff dashboard. Double-booking is prevented at the DB level.

### 3.1 Lib helpers

- [x] `lib/signed-cookie.ts` — HMAC sign + verify (Node `crypto`); reads `SESSION_COOKIE_SECRET`
- [x] `lib/pricing.ts` — `calculateBookingTotal({ basePrice, nights, taxRate, serviceRate })` returns subtotal / tax / service / total
- [x] `lib/availability.ts` — `findAvailableRoom(supabase, roomTypeId, checkIn, checkOut)` and `isStillAvailable(supabase, roomId, checkIn, checkOut)`
- [x] `lib/validation/rooms.ts` — Zod schemas: `roomTypeSchema`, `roomSchema`, `bookingFormSchema`, `bookingIntentSchema`

### 3.2 Migrations

- [x] `supabase/migrations/0005_booking_constraints.sql` — `btree_gist` extension, exclusion constraint on `bookings (room_id, daterange(check_in, check_out))` filtered to active statuses, guest-owner INSERT policy, refreshed `handle_new_auth_user()` to also pick up phone from `raw_user_meta_data`
- [x] `supabase/migrations/0006_sample_rooms.sql` — three room types (Standard / Deluxe / Suite) + three rooms each, idempotent

### 3.3 Staff dashboard scaffold

- [x] `app/(staff)/dashboard/layout.tsx` — staff guard, sidebar
- [x] `app/(staff)/dashboard/page.tsx` — staff home (placeholder cards; richer in Phase 5)
- [x] `components/staff/sidebar.tsx` — role-aware nav

### 3.4 Manager rooms CRUD

- [x] `/dashboard/rooms` — combined room-types + rooms list, with create + per-row edit + delete forms; manager+ guard
- [x] Server actions for room_types (auto-slug from name if blank, amenities/images parsed from textareas, audit log)
- [x] Server actions for rooms (room_number + type + floor + status, audit log)

### 3.5 Public rooms

- [x] `app/rooms/page.tsx` — public listing of active room types with image, price, max_guests, amenities
- [x] `app/rooms/[slug]/page.tsx` — detail page with gallery + booking form
- [x] `components/public/booking-form.tsx` (client component) — live total preview as dates/guests change
- [x] `app/rooms/[slug]/actions.ts` — `initiateBooking` server action: validate, recompute total, check availability, stash signed intent cookie, send OTP via `signInWithOtp({ shouldCreateUser: true, data: { full_name, phone } })`, redirect to `/verify-otp?next=/booking/finalize`

### 3.6 Booking finalize + confirmation + my bookings

- [x] `app/booking/finalize/page.tsx` — reads signed cookie (after OTP verify), re-checks availability, inserts booking row (RLS owner-insert policy), clears cookie, redirects to confirmation (or future payment provider)
- [x] `app/booking/[id]/page.tsx` — booking confirmation / receipt
- [x] `app/my-bookings/page.tsx` — list current guest's bookings (auth required)
- [x] `.env.example` updated to ensure `SESSION_COOKIE_SECRET` is documented

### 3.7 Deferred (resolved status)

- [ ] Pay-online flow (Khalti / eSewa) — still deferred per user direction; the "online" branch in finalize redirects to confirmation with a `?pay=pending` banner. See Phase 4 §4.5.
- [x] Cancellation flow (computes refund_amount_due, marks status='cancelled') — landed in Phase 4 §4.1-4.2
- [x] Email confirmation send on booking — landed in Phase 4 §4.3 via `lib/email-from-template.ts`

### Phase 3 verification checklist

- [ ] Apply migrations `0005` + `0006`; sample rooms appear in `room_types` + `rooms`
- [ ] Set `SESSION_COOKIE_SECRET` in `.env.local` to a random string (e.g. `openssl rand -base64 32`)
- [ ] `npm run dev`; visit `/rooms` — three room types listed
- [ ] Visit `/rooms/deluxe` (or whatever slug); fill the booking form with valid dates, real email, phone, 1 guest
- [ ] OTP arrives; verify at `/verify-otp`; lands on `/booking/{id}` with confirmation details
- [ ] `/my-bookings` shows the new booking
- [ ] In Supabase dashboard, confirm the booking row exists with `verification_method = 'otp'`, snapshotted `total_amount`, and `payment_status='unpaid'`
- [ ] As a second guest, try to book the same room for overlapping dates → DB exclusion constraint rejects; user sees "no rooms available"
- [ ] Sign in as super_admin or manager; visit `/dashboard/rooms` — can edit / create / delete room types and rooms; price change applies to *new* bookings only (existing total_amount is snapshotted)

## Phase 4 — Cancellation + emails *(payments skipped per user direction)*

**Gate to advance:** A guest can cancel their own booking from `/booking/[id]`; staff can cancel any booking. Cancellation computes `refund_amount_due` from `cancellation_policy` tiers. A manager can record a manual refund (out-of-band) on `/dashboard/cancellations`. Email goes out on booking confirmation, cancellation, and refund.

### 4.1 Cancellation logic

- [x] `lib/cancellation.ts` — `computeRefund({ paidAmount, checkIn, tiers })` returns matching tier + refund amount + hours-until-check-in
- [x] `lib/email-from-template.ts` — reads `email_templates` by key (via admin client, bypassing super-admin-only read RLS), renders `{{vars}}`, sends via Resend

### 4.2 Cancellation actions

- [x] `app/booking/[id]/actions.ts` — `cancelBooking` action: owner-or-staff guard, computes refund, updates row via admin client (column-level safety — guest UPDATE not exposed via RLS), audit log, cancellation email
- [x] Updated `app/booking/[id]/page.tsx` — cancel form shown when status ∈ {pending, confirmed}
- [x] `app/(staff)/dashboard/cancellations/page.tsx` — list cancelled bookings with refund-pending vs refund-recorded states
- [x] `app/(staff)/dashboard/cancellations/actions.ts` — `recordRefund` action: manager+ guard, updates `refunded_amount` / `refund_reference` / `refunded_at` / `payment_status`, audit log, refunded email
- [x] `components/staff/sidebar.tsx` — added Cancellations nav link

### 4.3 Email send wiring

- [x] `app/booking/finalize/page.tsx` — fires `booking_confirmation` email after successful insert (fire-and-forget, errors logged but don't fail the booking)
- [x] Cancel + refund actions fire `booking_cancelled` / `booking_refunded` templates

### 4.4 Pay-at-hotel flow

- [x] Already wired in Phase 3 — booking lands `status='confirmed', payment_status='unpaid'`. No further changes.

### 4.5 Explicitly deferred (per user direction)

- [ ] Khalti initiate + webhook
- [ ] eSewa initiate + webhook
- [ ] Live `payments` row writes from webhooks
- [ ] Pay-online branch on `/booking/finalize` — currently lands on confirmation with `?pay=pending` and a banner

### Phase 4 verification checklist

- [ ] Make a pay-at-hotel booking; on `/booking/[id]` click **Cancel** more than 72h before check-in → refund tier matches "100%" and `refund_amount_due = paid_amount × 100%`
- [ ] Cancel a booking <24h before check-in → tier matches "0%" and `refund_amount_due = 0`
- [ ] In `audit_logs`, confirm a row with `action='delete'` (we use "delete" as the closest match for cancel) for the booking and `action='refund_recorded'` once refund is logged
- [ ] On `/dashboard/cancellations` as a manager, record a refund (amount + reference) → row moves from "Pending" to "Refunded"; `payment_status` becomes `refunded` (or `partially_refunded` if < total)
- [ ] Confirmation, cancellation, and refunded emails arrive (or `[email] skipped` log lines appear if `RESEND_API_KEY` is unset)

## Phase 5 — Staff Ops

**Gate to advance:** Receptionist can view today's arrivals/departures, check guests in and out (room status flips with the booking), create a walk-in booking with a stub profile. Manager can see basic revenue / occupancy numbers. Super admin can invite/disable staff and inspect the audit log.

### 5.1 Validation schemas

- [x] `lib/validation/staff.ts` — Zod for walk-in booking, check-in/out, staff invite, role change

### 5.2 Bookings ops (`/dashboard/bookings`)

- [x] Page lists today's arrivals + today's departures + recent bookings
- [x] Per-row Check-in / Check-out / Cancel forms (staff-write RLS allows update)
- [x] Server actions `checkIn` / `checkOut` flip booking status AND room status (`available` → `occupied` → `cleaning`) atomically via admin client
- [x] Audit log on each transition

### 5.3 Walk-in (`/dashboard/walk-in`)

- [x] Receptionist+ form: dates, room type, guest details (email optional), payment_method, optional initial check-in
- [x] Action finds an available room (admin client), creates or reuses a stub profile (no `auth_user_id`), inserts booking with `verification_method='staff_call'` and `verified_by=staff.id`
- [x] If admin marks paid at creation, insert a `payments` row; if initial status is `checked_in`, also flip the room to `occupied`

### 5.4 Reports (`/dashboard/reports`)

- [x] Manager+ guarded; simple metric cards: total bookings, confirmed bookings, all-time revenue, cancellation rate, occupancy snapshot, top room types by count
- [x] No charts — counts only; date filter deferred

### 5.5 Staff management (`/admin/staff`)

- [x] List of all non-guest profiles with role, is_active, last sign-in (if available)
- [x] `inviteStaff` action — creates a stub profile with the target role then sends `admin.auth.admin.inviteUserByEmail` so the new auth user links back to that stub via the trigger
- [x] `changeRole` + `toggleActive` actions (super_admin only)
- [x] All staff edits audited

### 5.6 Audit log viewer (`/admin/audit`)

- [x] Super-admin only; reverse-chronological list of audit_logs with action, entity, actor, timestamp
- [x] Click-to-expand JSON diff (old → new) using `<details>`
- [x] Filter inputs: action, entity_type, actor email, date range

### 5.7 Defense-in-depth

- [x] `middleware.ts` + `lib/supabase/middleware.ts` now also block disabled accounts (`is_active=false`) from `/dashboard` and `/admin` even if they still hold a session

### Phase 5 verification checklist

- [ ] As receptionist: visit `/dashboard/bookings` — today's arrivals and departures appear; check in a confirmed pay-at-hotel booking → booking row goes `checked_in`, room row goes `occupied`
- [ ] Check out a checked-in booking → booking `checked_out`, room `cleaning`
- [ ] Create a walk-in via `/dashboard/walk-in` for a guest with no email; the booking appears on `/dashboard/bookings`; check the profile row has `is_stub=true` and `auth_user_id` null
- [ ] As manager: `/dashboard/reports` renders metric cards; numbers match a hand-counted sample
- [ ] As super_admin: invite a new staff member with role `manager` via `/admin/staff` → an email arrives; after the invitee accepts, their profile has role `manager` (not `guest`)
- [ ] Disable a staff account → next page hit redirects them to `/`
- [ ] `/admin/audit` lists rows in reverse chronological order; the JSON diff opens on click

## Phase 6 — Add-ons

**Gate to advance:** Public `/menu` and `/services` browse-only pages render from the DB; a checked-in guest can request a service from their booking page and staff can handle it; admin can configure the Google Place ID, trigger a manual refresh, and `/reviews` renders from the cache; guest and reception can chat in realtime.

### 6.1 Food menu

- [x] `lib/validation/menu.ts` — food item schema
- [x] `/dashboard/menu` manager+ CRUD
- [x] `/menu` public browse-only, grouped by category, hides `is_available=false`

### 6.2 Services + service requests

- [x] `lib/validation/services.ts` — service + service-request schemas
- [x] `/dashboard/services-manage` manager+ CRUD
- [x] `/services` public listing
- [x] Service request widget on `/booking/[id]` for the guest, visible only when booking is confirmed/checked_in
- [x] `/dashboard/service-requests` for staff to update status (received → in progress → completed / cancelled)

### 6.3 Google Reviews integration

- [x] `lib/google-places.ts` — legacy Places API client + cache refresher
- [x] `/api/cron/refresh-google-reviews` GET endpoint, gated by `CRON_SECRET`
- [x] `vercel.json` — daily cron at 02:00 UTC
- [x] `/admin/reviews` super-admin page: shows configured Place ID, manual "Refresh now" button, last refresh timestamp + cached row count
- [x] `/reviews` public page rendering rows from `google_reviews_cache`

### 6.4 Chat (guest ↔ reception, Supabase Realtime)

- [x] `supabase/migrations/0007_realtime_publication.sql` — adds `messages`, `conversations`, `notifications` to `supabase_realtime` (idempotent)
- [x] `/chat` guest page with realtime subscription via a client component
- [x] `/dashboard/chat` staff inbox listing conversations with unread counts
- [x] `/dashboard/chat/[conversationId]` shared inbox per-conversation view, also realtime
- [x] Server actions create the conversation on first message; the existing `on_new_message` trigger handles `last_message_at` and unread counts
- [x] Viewing a chat marks the side's `*_unread_count` back to 0

### 6.5 Sidebars

- [x] `components/staff/sidebar.tsx` — Menu, Services, Service requests, Chat
- [x] `components/admin/sidebar.tsx` — Reviews

### Phase 6 verification checklist

- [ ] Apply migration `0007_realtime_publication.sql`
- [ ] Add `GOOGLE_PLACES_API_KEY` + `CRON_SECRET` to `.env.local`
- [ ] Create a food item on `/dashboard/menu`; it appears on `/menu` under its category
- [ ] Create a service; it appears on `/services` and in the service-request picker on a confirmed booking
- [ ] As a guest with a confirmed booking, request a service from `/booking/[id]`; row appears on `/dashboard/service-requests`; mark it completed → row moves to completed bucket
- [ ] Configure a Place ID in `/admin/settings`, then on `/admin/reviews` click **Refresh now** — review cards appear on `/reviews`
- [ ] In one browser as guest visit `/chat` and send a message. In another as staff visit `/dashboard/chat/[id]` — the message appears live (no refresh)
- [ ] Send a reply from staff — guest tab receives it instantly via realtime
- [ ] Visiting `/chat` as the guest after staff replied resets `guest_unread_count` to 0; visiting the staff inbox page resets `staff_unread_count`

## Phase 6.5 — UI redesign (boutique premium)

**Gate to advance:** Site looks intentional — palette, typography, status badges, empty states, and page chrome applied consistently across public, staff, and admin surfaces. No layouts or server actions changed; presentation layer only.

### 6.5.1 Design tokens

- [x] `app/globals.css` — terracotta + sand + copper palette, `success` / `warning` / `danger` status tokens, `--radius: 0.75rem`, `.shadow-soft` / `.shadow-soft-lg` / `.bg-linen` utilities, `.font-display` helper, refined dark mode
- [x] `tailwind.config.ts` — added `success` / `warning` / `danger` color tokens, `font-display` family, `display-xl` / `display-lg` font sizes, `fade-in` animation
- [x] `app/layout.tsx` — loads Inter + Playfair Display via `next/font` (`--font-sans` + `--font-display`). Dropped the literal `<head>` (was causing a hydration warning) and the unused `--brand-*` CSS-var injection. Branding-color admin field is documentation-only for v1; the locked palette ships as-is

### 6.5.2 New primitives

- [x] `components/ui/badge.tsx` — `default` / `success` / `warning` / `danger` / `info` / `outline` / `solid` variants + status helpers `bookingStatusBadge`, `paymentStatusBadge`, `roomStatusBadge`, `requestStatusBadge`
- [x] `components/ui/empty-state.tsx` — icon + heading + description + optional CTA
- [x] `components/ui/page-header.tsx` — display-serif h1 + eyebrow + description + trailing actions
- [x] `components/ui/metric.tsx` — dashboard tile with label / value / hint / icon, optional `href` link, `default` / `accent` / `primary` tones
- [x] `components/ui/avatar.tsx` — image with initials fallback
- [x] `components/public/site-header.tsx` — sticky public nav with role-aware "Sign in" / "My bookings" pill
- [x] `components/public/site-footer.tsx`
- [x] `components/public/nav-link.tsx` — client component that highlights the active route in sidebars + public nav

### 6.5.3 Polished existing primitives

- [x] `components/ui/button.tsx` — `accent` variant, active-press scale, soft-shadow on filled variants
- [x] `components/ui/card.tsx` — soft layered shadow, 12px radius
- [x] `components/ui/input.tsx` + `textarea.tsx` — accent focus ring, hover border

### 6.5.4 Public site

- [x] `app/page.tsx` — boutique hero (eyebrow chip, dual CTA, room-preview card), quick-highlight cards, CMS-driven amenities chip list, primary CTA strip
- [x] `app/rooms/page.tsx` — image-led grid with price tag overlay, sleeps-N chip, amenity pills, hover lift
- [x] `app/rooms/[slug]/page.tsx` — 5-image asymmetric gallery, display-serif name, amenity grid, sticky booking card on `lg+`
- [x] `components/public/booking-form.tsx` — segmented "Pay at hotel" / "Pay online" picker cards (active-ring), merged date inputs, display-serif total
- [x] `components/public/sections.tsx` — refined hero / text / cta / gallery / faq renderers (hover lift on gallery, accordion FAQ with rotating +/×)
- [x] `app/menu/page.tsx`, `app/services/page.tsx`, `app/reviews/page.tsx` — `PageHeader`, `EmptyState`, refined card grids; reviews shows an average-rating chip
- [x] `app/my-bookings/page.tsx`, `app/booking/[id]/page.tsx` — receipt-style with `Badge` for status + payment, hover lift on list rows, banner tones for cancelled/refunded/error/success

### 6.5.5 Auth

- [x] `app/(auth)/login/page.tsx` + `app/(auth)/verify-otp/page.tsx` — split-screen with deep-primary hero panel (blur-blob accent gradients) on left, form on right. OTP input centered with `font-mono` + wide tracking

### 6.5.6 Staff portal

- [x] `components/staff/sidebar.tsx` — brand dot, role label, avatar + role footer card, active-state `NavLink`, "Admin panel →" pill for super_admins
- [x] `app/(staff)/dashboard/page.tsx` — 6 `Metric` tiles (arrivals / departures / occupancy / open chats / pending refunds / service requests) + today's-arrivals preview list
- [x] `app/(staff)/dashboard/bookings/page.tsx` — `SectionHead` per group, status + payment `Badge` on every row, cleaning queue chips, `EmptyState` per section, primary check-in + accent check-out buttons
- [x] `app/(staff)/dashboard/chat/page.tsx` — unread rows highlighted with accent border + count badge
- [x] `app/(staff)/dashboard/chat/[conversationId]/page.tsx` — Avatar header
- [x] `app/(staff)/dashboard/reports/page.tsx` — `Metric` tiles + occupancy progress bar + top-room-types relative-width bars + status-breakdown tiles
- [x] `/dashboard/walk-in`, `/dashboard/cancellations`, `/dashboard/service-requests`, `/dashboard/rooms`, `/dashboard/menu`, `/dashboard/services-manage` — `PageHeader` + `Badge` + `EmptyState`

### 6.5.7 Admin portal

- [x] `components/admin/sidebar.tsx` — same treatment as staff sidebar with active state
- [x] All 11 admin pages — `PageHeader` applied. `Badge` on staff list (invite-pending / role / disabled), pages list (published / draft). `EmptyState` on FAQs / amenities / testimonials / gallery / audit when empty. Avatar in staff list + Google reviews preview

### 6.5.8 Chat

- [x] `components/chat/realtime-chat.tsx` — bubble polish (mine = primary, theirs = muted), Avatar in bubbles, "Today / Yesterday / date" dividers, rounded icon-only send button

### Known limitation

- Sidebars are desktop-only (256px fixed). No mobile hamburger drawer yet — small viewports show a cramped sidebar. Follow-up work.

## Phase 7 — Mobile + a11y polish

**Gate to advance:** Sidebars work on mobile via a drawer; public nav collapses into a hamburger drawer; every page exposes a "Skip to content" link; icon-only buttons have `aria-label`s; primary navs have `aria-label="Primary"`.

### 7.1 Mobile sidebar drawer

- [x] `components/shell/responsive-shell.tsx` — client wrapper with a sticky mobile top bar (hamburger + brand), backdrop, slide-in drawer that wraps the sidebar; route-change auto-close + body-scroll lock when open; degrades to a normal static sidebar at `lg+`
- [x] `app/(staff)/dashboard/layout.tsx` and `app/(admin)/admin/layout.tsx` both render through `ResponsiveShell` now — no other changes to per-page padding or sidebar internals required

### 7.2 Public mobile nav

- [x] `components/public/mobile-nav.tsx` — slide-from-right drawer, active-link highlight, includes Sign in / My bookings depending on session
- [x] `components/public/site-header.tsx` — hamburger trigger shown below `md`, primary nav stays inline on `md+`, gets `aria-label="Primary"`

### 7.3 A11y basics

- [x] `app/layout.tsx` — "Skip to content" link, `sr-only` until focus
- [x] All public + auth `<main>` elements get `id="main"` so the skip link targets them
- [x] `ResponsiveShell` renders `<main id="main">` for dashboard + admin
- [x] All icon-only buttons (open menu, close menu, send chat, etc.) have `aria-label`
- [x] Decorative bullets / dividers marked `aria-hidden`
- [x] Drawer close buttons receive focus and respect `tabIndex` when closed

### Phase 7 verification checklist

- [ ] On a mobile viewport: open any `/dashboard/*` page; hamburger appears, drawer slides in, content scrolls beneath it, route change auto-closes
- [ ] Same on `/admin/*`
- [ ] On a mobile viewport on `/`, `/rooms`, `/menu`, etc., hamburger in the top-right opens the public nav
- [ ] Tab from the address bar before hitting any UI; first focusable element is the "Skip to content" link; pressing Enter focuses the main content area
- [ ] Run `axe-devtools` on `/`, `/rooms/[slug]`, `/dashboard/bookings` — confirm no critical violations

## Post-Phase 6

- Security review (RLS coverage, webhook signature paths, OTP brute-force, audit gaps)
- Performance: `next/image` migration where remote hosts are stable, RSC caching strategy, DB index review
- Vercel + Supabase Pro deployment, daily backups verified

---

## Open questions / deferred decisions

- Generated Supabase types: run `supabase gen types typescript --linked > types/supabase.ts` once project is linked. Until then, `types/database.ts` is a stub.
- Google Places API: requires a billable Google Cloud project + Place ID for the property. Cron schedule TBD (Vercel Cron or Supabase Edge Function on schedule).
- SMS provider listed in §2.3 of arch doc is **not** wired — §4.1 says email-only OTP. Removed from scope; if reintroduced, revisit `otp_verifications` schema.

## Change log

- 2026-05-26 — Plan file created.
- 2026-05-26 — Phase 1 scaffolding written (config, app shell, Supabase clients, middleware, SQL migrations, seed). Verification gate still pending — needs `npm install` + Supabase project + migration apply.
- 2026-05-26 — Phase 2 first iteration: UI primitives (button/input/label/textarea/card/switch), `lib/audit.ts` + `lib/email.ts` + validation schemas, email-OTP login flow (login + verify-otp + logout), admin shell with sidebar, CMS pages for site_settings/branding/FAQs/amenities (each with audit-logged server actions), storage bucket migration (0004). Pages/gallery/testimonials/templates editor deferred to next iteration.
- 2026-05-26 — Phase 2 closed: pages + sections editor (5 section types: hero/text/gallery/cta/faq), public homepage renders from page_sections with a fallback when none defined, gallery with Supabase Storage upload (admin-client, rollback on DB-insert failure), testimonials CRUD, templates editor (email + notification). Sidebar now exposes 8 admin sections. Phase 2 status flipped to `[x]`.
- 2026-05-26 — Phase 3 closed: lib helpers (`signed-cookie`, `pricing`, `availability`, `validation/rooms`), migrations 0005 (btree_gist exclusion constraint on bookings + guest owner-insert RLS + refreshed `handle_new_auth_user` to forward phone) and 0006 (3 room types + 9 sample rooms), staff dashboard scaffold at `/dashboard` with manager-guarded `/dashboard/rooms` CRUD, public `/rooms` listing + `/rooms/[slug]` detail with a client-side live-total booking form, OTP-gated booking flow (signed-cookie intent + `signInWithOtp({shouldCreateUser:true})` + `/booking/finalize` that re-checks availability and inserts via owner-insert policy), booking confirmation page at `/booking/[id]`, `/my-bookings` listing for the signed-in guest. Phase 3 status flipped to `[x]`.
- 2026-05-26 — Phase 4 (cancellation slice only, payments deferred): `lib/cancellation.ts` matches a tier from `cancellation_policy` and computes refund amount; `lib/email-from-template.ts` resolves an `email_templates` row by key (via admin client) and ships via Resend; `/booking/[id]` exposes a guest-or-staff cancel form when status is pending/confirmed; `/dashboard/cancellations` lists cancelled bookings with manager+ refund-recording (refunded_amount + reference, transitions payment_status to refunded / partially_refunded); booking finalize now fires `booking_confirmation` email; cancel/refund actions fire `booking_cancelled` / `booking_refunded`. Sidebar wired. Khalti/eSewa initiation + webhook routes intentionally not implemented per user direction.
- 2026-05-26 — Phase 5 closed: `lib/validation/staff.ts` (walk-in / invite / role / active schemas), `/dashboard/bookings` (today's arrivals + departures + recent + cleaning queue) with `checkIn` / `checkOut` / `markRoomReady` actions that atomically flip booking + room statuses, `/dashboard/walk-in` form that creates a stub profile (linked-by-email if one exists) and a booking with `verification_method='staff_call'` plus optional immediate check-in and a `payments` row when paid at desk, `/dashboard/reports` manager+ metric cards (bookings / revenue / cancellation rate / occupancy / top room types), `/admin/staff` invite (preserves role through `handle_new_auth_user` trigger) + role change + enable/disable with self-demote and self-disable safeguards, `/admin/audit` reverse-chrono table with action/entity/actor/date filters and click-to-expand JSON diff; middleware now blocks disabled accounts (`is_active=false`) from `/admin` and `/dashboard`. Sidebars wired.
- 2026-05-26 — Phase 6 closed: food menu (manager+ `/dashboard/menu` CRUD + public `/menu` grouped by category), services (manager+ `/dashboard/services-manage` CRUD + public `/services`), guest service-request widget on `/booking/[id]` + staff handler at `/dashboard/service-requests` with status transitions, Google Reviews integration (`lib/google-places.ts` + `/api/cron/refresh-google-reviews` gated by `CRON_SECRET` + `vercel.json` daily at 02:00 UTC + super-admin `/admin/reviews` config and manual refresh + public `/reviews`), realtime chat (migration 0007 publishes messages/conversations/notifications to `supabase_realtime`, `components/chat/realtime-chat.tsx` client component subscribes to `postgres_changes`, guest `/chat` page auto-creates a conversation on first message, staff `/dashboard/chat` inbox + per-conversation `/dashboard/chat/[id]`, viewing either side resets the corresponding unread counter and marks messages read). Sidebars finalized: 10 staff items + 11 admin items. The build matches the architecture doc end-to-end (less payments).
- 2026-05-27 — Frontend-only preview added: `lib/supabase/stub.ts` returns a fake client (canned data for `profiles`/`site_settings`/`branding`/`room_types`/`bookings`, generic id-bearing stub elsewhere, no-op writes, no-op realtime channels). All four Supabase entry points (`server`, `client`, `admin`, `middleware`) auto-fall-back to stub when env vars are missing. New `STUB_AS` env var fakes a session at a chosen role (`guest` / `receptionist` / `manager` / `super_admin`) so admin + dashboard pages are browsable without Supabase. `components/stub-banner.tsx` renders a yellow banner sitewide when stub mode is active. README + `.env.example` document the flow.
- 2026-05-27 — Dev port moved to 4000 (`npm run dev` / `npm run start` pass `-p 4000`; README + `.env.example` updated).
- 2026-05-27 — **Phase 6.5 closed (UI redesign — boutique premium):** new tokens in `globals.css` (terracotta + sand + copper palette, status colors, soft shadows, `.bg-linen`); `tailwind.config.ts` extended with status colors + `font-display` + display font sizes; Inter + Playfair Display loaded via `next/font`. New primitives — `Badge` (with status helpers), `EmptyState`, `PageHeader`, `Metric`, `Avatar`, `SiteHeader`, `SiteFooter`, `NavLink` (active-state). Polished `Button` (accent variant), `Card` (soft shadow), `Input` / `Textarea` (accent focus). Public site got a hero homepage, image-led `/rooms` grid, sticky booking card on `/rooms/[slug]`, segmented payment-method picker, average-rating chip on reviews, receipt-style booking detail. Auth pages → split-screen with primary-color hero. Staff dashboard home redesigned with 6 `Metric` tiles + arrivals preview; `/dashboard/bookings` got `SectionHead` + status badges + empty states. Reports got progress bars. Chat got bubble polish + avatars + date dividers. Every admin + staff CRUD page got `PageHeader` + `Badge` + `EmptyState`. Sidebars unified treatment with active state, avatar footer, role label. No server actions or routing changed. Known limitation: sidebars are desktop-only.
- 2026-05-27 — Fixed hydration warning from literal `<head>` element in `app/layout.tsx`. Dropped the `<head>` (whitespace text nodes are invalid children) and the dead `--brand-*` CSS-var injection (nothing in the theme was reading those variables). `next/font` className handles font-vars; `generateMetadata` handles `<head>`.
- 2026-05-27 — **Phase 7 closed (mobile + a11y polish):** `components/shell/responsive-shell.tsx` wraps both `/dashboard` and `/admin` layouts with a mobile drawer (sticky top bar with hamburger + brand, slide-in sidebar, backdrop close, body-scroll lock, route-change auto-close, degrades to static sidebar at `lg+`). `components/public/mobile-nav.tsx` adds a slide-from-right hamburger drawer for the public site header at `md-`. Root layout exposes a `Skip to content` link (sr-only until focus); every `<main>` element gains `id="main"`. Icon-only buttons (open / close menu, send chat) get `aria-label`. Primary navs get `aria-label="Primary"`. Phase 3 §3.7 housekeeping: ticked the two items that actually landed in Phase 4 (cancellation flow + booking confirmation email).
- 2026-05-27 — Added `scripts/check-env.mjs` (`npm run check`) — verifies env vars are set, parses .env / .env.local without dependencies, pings Supabase Auth + REST + Admin endpoints, reports user count and seed-row presence. Reads at runtime, masks secrets.
- 2026-05-27 — **Stub mode removed.** Deleted `lib/supabase/stub.ts` and `components/stub-banner.tsx`. The four Supabase entry points (`server`, `client`, `admin`, `middleware`) now throw a clear "Missing X env var" error if required keys are missing, instead of silently falling back to a fake client. `STUB_AS` env var removed from `.env.example`. README "Frontend-only preview" section deleted. Stub-mode banner on `/verify-otp` removed. The app now *requires* real Supabase env config to boot.
- 2026-05-29 — **Final polish pass.** Smoke + CRUD across all 33 routes, found three polish gaps:
  1. **Pages CMS was dead code on the public side.** `/admin/pages` lists About/Contact/Terms editors, but the corresponding public routes never existed — content edited there rendered nowhere. Created shared `components/public/cms-page.tsx` (queries `pages` by slug + sections from `page_sections`, polite empty state when no sections defined, 404 if unpublished). Added `app/about/page.tsx`, `app/contact/page.tsx`, `app/terms/page.tsx` (4-line wrappers each). Footer now links to all three.
  2. **Branding form mis-implied it controls the rendered theme.** The site's palette is hardcoded in `globals.css` per the boutique-redesign decision; edits to `/admin/branding` were silently saved-to-DB but never applied. Added a warning banner explaining the state honestly.
  3. **Audit-log entity ID truncation** — `entity_id.slice(0, 8)` cut `"singleton"` to `"singleto"`. Now only truncates IDs longer than 12 chars (UUIDs still shorten to first 8).

  Final smoke: 33/33 routes return 200 with zero console errors, signed-in as super_admin.
- 2026-05-29 — **Mobile responsive audit + fixes.** At 375px wide every public page was overflowing horizontally by ~288px because (1) the mobile-nav drawer when closed sits at `position:absolute right:0`, (2) reviews-slider cards extend off-canvas by design, (3) decorative blur dots on the CTA card use `-right-20`. Added `overflow-x: clip` to both `html` and `body` in `app/globals.css` — this stops the document from being horizontally scrollable while leaving inner scroll-snap containers (the slider) free to scroll. Also fixed the `/dashboard/bookings/calendar` toolbar that was wrapping "May 2026" onto three lines and making the day cells too tall to be useful: stacked the top bar (flex-col → sm:flex-row), shrank day-cell min-height to 64px on mobile (was 112px), swapped weekday headers to single letters on mobile, and replaced the per-cell guest-name list with `+N / −N` count chips on mobile (keeps cells scannable). Verified at 375px on every public page, every back-office page, the date picker, the reviews slider, both hamburger drawers.
- 2026-05-29 — **Resend removed too.** Same reasoning as Brevo — Gmail SMTP wins the chain when `GMAIL_APP_PASSWORD` is set, so Resend's branch was never executing in current configuration. `lib/email.ts` now sends only via Gmail nodemailer (or logs + no-ops if Gmail isn't set). Removed `sendViaResend()`, the `Resend` import, `RESEND_*` env vars, and ran `npm uninstall resend` (one fewer dep). Updated `scripts/check-env.mjs` to check `GMAIL_USER` + `GMAIL_APP_PASSWORD` instead of Resend's. Updated `docs/project-guide.html` env-vars table. Updated `lib/booking-otp.ts` docstring. No behaviour change in active code path — booking OTP, booking confirmation, cancellation, refund emails still all go through `sendEmail()` → Gmail nodemailer.
- 2026-05-29 — **Brevo removed.** Brevo was a documented dead branch (Gmail SMTP wins the priority chain when `GMAIL_APP_PASSWORD` is set, which it is). Deleted `sendViaBrevo()` from `lib/email.ts`, removed `BREVO_*` vars from `.env` and `.env.example`, updated the docstring + log warning to reflect the simpler Gmail → Resend → log-only chain. No code changes outside `lib/email.ts`.
- 2026-05-29 — **Repo cleanup.** Deleted `_prototype/` (old HTML demos), `screenshots/` (21MB of test PNGs), `photos/converted/` (14MB of JPEGs already in Supabase Storage), `tsconfig.tsbuildinfo` (gitignored build cache), `supabase/migrations/_bundle.sql` (one-shot initial bundle), paired migrations `0009_guest_reviews.sql` + `0010_drop_guest_reviews.sql` (net no-op), and `scripts/e2e-test.mjs` (one-off Playwright). Moved `hotel-system-architecture.docx.pdf` into `docs/`. Cleaned `.env` and `.env.example`: removed unused Khalti/eSewa blocks (payments deferred), deduped the empty Brevo placeholder, reorganized the email priority chain comment as Gmail → Brevo → Resend. Updated `.gitignore` to cover `screenshots/` + `photos/converted/`. Updated `README.md` paths and email-provider description. ~35MB freed locally; migration history now 0001–0008 + 0011 (gap is fine — Supabase migrations don't need to be consecutive).
- 2026-05-28 — **Reviews slider with testimonials fallback.** New `components/public/reviews-slider.tsx` — native CSS scroll-snap horizontal slider with desktop prev/next arrow buttons (mobile uses native touch swipe). Cards are 85vw on mobile, 420px on desktop, with line-clamp-6 on the body. Homepage now queries both `google_reviews_cache` and `testimonials` and picks the source: Google when ≥3 cached, else testimonials. Single boundary line keeps the swap automatic when the cache eventually populates. Each card badged "Google" or "Guest" so the source is honest.
- 2026-05-28 — **Reviews consolidated to homepage.** Killed the standalone `/reviews` page; the reviews UI (summary card + cached reviews grid + Google CTA) now lives as a `id="reviews"` section between the gallery teaser and the FAQs on `/`. Public nav header and footer links updated to `/#reviews` anchor. Homepage query now pulls top 4 cached reviews alongside the existing data fetches. Empty state ("No written reviews here yet") still renders when Google's relevance filter returns nothing.
- 2026-05-28 — **Google rating surfaced across public site.** New `components/public/google-rating-chip.tsx` (light + dark variants) renders "★ 4.3 on Google · 55" as a clickable chip that links to the Maps listing in a new tab. Wired into: (1) homepage hero — chip next to the "Boutique hospitality" eyebrow on the dark photo overlay; (2) homepage stats strip — when rating is set, the third tile flips from "Amenities" to "Google rating"; (3) `/rooms/<slug>` detail header — chip right-aligned with the room name; (4) booking confirmation email — a new "★ Leave a review on Google" outline-button below the booking summary, driven by a new `google_review_url` template variable (`verifyAndCreateBooking` now reads `google_place_uri` from site_settings and passes it through).
- 2026-05-28 — **Google Reviews summary fallback (Places API New).** Migrated `lib/google-places.ts` from the legacy `maps.googleapis.com/maps/api/place/details/json` to **Places API (New)** at `places.googleapis.com/v1/places/{id}` with `X-Goog-Api-Key` + `X-Goog-FieldMask` headers. New `fetchPlaceDetails()` returns `{summary, reviews}` — Google's new API often returns 0 reviews for small/non-English listings (their relevance algorithm) but always returns rating + count, so we persist those on `site_settings` (new columns: `google_place_name`, `google_place_rating`, `google_place_rating_count`, `google_place_uri`, `google_place_fetched_at` via migration 0011). `/reviews` now leads with a summary card (avg rating, ratings count, "Read all on Google" CTA) that renders even when the cache is empty. `/admin/reviews` shows a new "Live summary" card with the same data + an open-on-Google link, plus a clarifying note next to the cached-reviews count when the API returns 0. Caller compatibility preserved (`fetchPlaceReviews` shim) — cron route works unchanged.
- 2026-05-28 — **Reverted guest_reviews; staying on Google Reviews only.** Migration 0010 drops `guest_reviews`. Deleted `/review/[token]/` and `/admin/guest-reviews/`. Restored `/reviews/page.tsx` to the Google-cache-only version. Sidebar "Guest reviews" item removed.
- 2026-05-28 — **Lightbox + calendar + availability picker + guest reviews.** Four-feature batch:

  **Image lightbox** — new `components/public/image-lightbox.tsx` render-prop component (Esc / arrow-key navigation, click-backdrop close, body-scroll lock when open). Wired into the room-detail gallery (new `room-gallery.tsx` client component) and the homepage gallery teaser (new `gallery-teaser.tsx`).

  **Booking calendar** — new `/dashboard/bookings/calendar` page with 7×6 month grid, prev/next month nav via `?m=YYYY-MM`. Each day cell shows arrivals (green chip), departures (warning chip), and in-house occupancy count. Pulls active-status bookings whose stay overlaps the visible month. "Month view" pill added next to the existing list-view header.

  **Availability-aware date picker** — new `/api/availability` GET route returns the set of blocked dates (every-room-booked days) for a given `room_type_id` over the next 180 days. New `components/public/date-range-picker.tsx` client component renders two months side-by-side with blocked days disabled (strike-through), highlights the selected check-in/check-out and the range between. Replaces the native `<input type=date>` in `BookingForm`; emits `check_in`/`check_out` as hidden inputs so the server action receives the same field names.

  **Guest reviews** — migration `0009_guest_reviews.sql` adds `guest_reviews` (id, booking_id UNIQUE, rating 1–5, body, author_name, is_approved, rejected_reason, submitted_at, approved_at, approved_by). RLS allows public read of approved-only + staff read of everything; writes via admin client. New `/review/[token]/page.tsx` (guest submission via the booking's `access_token`) + `/admin/guest-reviews` (moderation with Approve / Reject inline forms). `/reviews` public page now merges approved guest reviews with the Google cache, tagged Direct / Google via `Badge`. Sidebar gains a "Guest reviews" entry in the Content section.

- 2026-05-28 — **Homepage redesign (editorial showcase).** Threw away the CMS-driven section rendering for `/` and rebuilt as a single hand-tuned page in `app/page.tsx`. Cinematic image-hero (preferring the Exterior gallery photo as background, dark gradient overlay, white headline + dual CTAs), 4-tile stats strip, 3-up featured rooms (cheapest / median / top-tier picked from the live `room_types` table), asymmetric story section with the Dining/Reception photo, 4×2 amenities icon grid mapping icon names → Lucide icons (wifi/waves/sparkles/utensils/dumbbell/car/concierge-bell/martini), masonry gallery teaser (1 large + 5 small) with hover-reveal captions, FAQ accordion in editorial side-by-side layout, primary-color CTA card with accent blur glows. All images via `next/image`. Page is fully data-driven from `site_settings`/`room_types`/`amenities`/`gallery_images`/`faqs` — no CMS sections needed. `pages` and `page_sections` tables still drive `/about`, `/contact`, `/terms`.
- 2026-05-28 — **Unified back-office nav.** Replaced the two separate sidebars (`components/staff/sidebar.tsx`, `components/admin/sidebar.tsx`) with one `components/shared/back-office-nav.tsx` rendered by both the `/dashboard/*` and `/admin/*` layouts. Items are grouped into **Today** (ops), **Catalog** (priced inventory: rooms/menu/services), **Content** (CMS: pages/gallery/FAQs/amenities/testimonials/Google reviews), and **System** (reports/settings/branding/templates/staff/audit). Visibility is per-item by `minRole` so receptionists see Today only, managers add Catalog + Reports, super_admins see everything. Header sublabel changed from "Staff portal" / "Admin" → "Back office" — same nav, same look, regardless of URL space. Cross-link pills ("Admin panel →" / "Staff dashboard →") removed since they're redundant when the sidebar is identical. Also fixed a prefix-match bug in `NavLink` where the Overview item lit up on every `/dashboard/*` page — added an `exact?: boolean` flag, default false, used for section-root items.
- 2026-05-28 — **Admin sidebar cross-link to dashboard.** Added a "Staff dashboard →" pill in `components/admin/sidebar.tsx` below the nav, mirroring the existing "Admin panel →" pill in `components/staff/sidebar.tsx`. Super admins were getting stuck in `/admin/*` with no way to reach `/dashboard/rooms` (where rooms management lives) short of typing the URL. The split remains: `/admin/*` = CMS, `/dashboard/*` = ops; the cross-link is just a discoverability fix.
- 2026-05-28 — **Real photos + property room structure.** Converted all 28 HEIC files in `photos/` to web-friendly JPEGs (`photos/converted/`, sharp + heic-convert pipeline: 1920px long edge, q85 mozjpeg — total 60MB → 14MB). Uploaded 13 room photos to `public-images/rooms/` and 12 property photos to `public-images/gallery/` on Supabase Storage. Restructured the catalog from the 3 placeholder types (Standard / Deluxe / Suite) to **6 types matching the property's actual layout**: Standard Single (NPR 2,000, 5 rooms #101–105, 3 photos), Standard Double (NPR 3,000, 5 rooms #201–205, 4 photos), Standard Triple (NPR 3,500, 3 rooms #301–303, 1 photo), Premium Double (NPR 4,500, 5 rooms #401–405, 5 photos), Premium Triple (NPR 6,500, 1 room #501, 2 photos), Premium Suite (NPR 8,500, 1 room #601, 1 photo). Existing #101–303 rooms repurposed in-place (kept their UUIDs to preserve the test booking's FK). 12 property photos seeded into `gallery_images` across Exterior / Grounds / Dining / Reception / Rooms categories. Verified visually via Playwright on `/rooms` (6-card grid with real photos + amenities chips) and each detail page. `IMG_0158.MOV` (video) skipped — no schema support.
- 2026-05-28 — **Gmail SMTP added as third email provider.** Brevo turned out to be gated on a manual activation review for new accounts (403 `permission_denied`). Added a Gmail-via-`nodemailer` path that wins when `GMAIL_APP_PASSWORD` is set — no signup, no activation gate, ~500/day soft cap, sends to anyone. New deps: `nodemailer` + `@types/nodemailer`. Lib priority is now Gmail → Brevo → Resend → log-only; `.env.example` updated with `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `GMAIL_FROM_NAME`. Cached transport via a module-level singleton so we don't reauth per send.
- 2026-05-28 — **Brevo added as alternative email provider.** `lib/email.ts` now picks Brevo when `BREVO_API_KEY` is set, otherwise Resend, otherwise log-only. Brevo (formerly Sendinblue) supports single-sender verification — verify one Gmail/email as sender, no domain required, 300 emails/day free tier — so the OTP booking flow can be tested with real recipients without owning a domain. Direct HTTP to `api.brevo.com/v3/smtp/email`, no new dependency. `.env.example` and `.env` updated with `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` placeholders. To activate: sign up at brevo.com → Senders & IPs → add and verify a sender (clicks a link in your inbox) → SMTP & API → create a v3 API key → paste both into `.env` and restart `npm run dev`.
- 2026-05-28 — **Header CTA cleanup.** Dropped the public "Sign in" CTA from `components/public/site-header.tsx` (header + mobile drawer) — confusing for guests now that they don't have accounts. Added a small "Staff sign in" link to the footer copyright row in `components/public/site-footer.tsx`. Signed-in users still see "My bookings" in the header (mostly useful for staff who book personal stays).
- 2026-05-28 — **Account-less booking (major rewire).** Decoupled the guest booking flow from Supabase Auth entirely. Before: `initiateBooking` called `signInWithOtp({shouldCreateUser:true})`, creating an `auth.users` row, then `/booking/finalize` consumed the session to insert the booking. After: `initiateBooking` calls `createBookingOtp(email)` (new `lib/booking-otp.ts` — 6-digit code, HMAC-hashed against `SESSION_COOKIE_SECRET`, stored in `otp_verifications` with `purpose='booking'`, 15-min TTL, 5-attempt cap) and sends via Resend directly. New `/booking/verify` page reads the booking-intent cookie, accepts the code, validates, then creates a **stub profile** (no `auth_user_id`, `is_stub=true`) and the booking row via admin client — RLS bypassed because the OTP itself is the authorization. New migration 0008 adds `bookings.access_token uuid` (auto-generated per row, indexed); the confirmation URL becomes `/booking/<id>?t=<token>` and is reachable without a session. `/booking/[id]/page.tsx` accepts the token via `?t=` and switches to admin-client reads when the token matches; staff sessions still work via the existing RLS path. `cancelBooking` accepts the token as a hidden form field and authorizes anonymously when it matches. Service requests stay session-gated (anonymous viewers see existing requests but can't create new ones). `/booking/finalize` deleted — no longer needed. `booking_confirmation` email template updated to include `{{view_url}}` button. Email send is now fail-soft: if Resend rejects (e.g. unverified-domain restriction), the action redirects with a helpful error instead of crashing with 500. Smoke-tested end-to-end via Playwright: form submit → verify page → OTP confirm → tokenized confirmation page survives a full cookie clear.
- 2026-05-28 — **E2E browser walk + fixes.** Installed Playwright + Chromium, drove all 33 public/auth/admin/dashboard pages via headless Chromium. Authenticated by minting an OTP through Supabase admin `generate_link` API and submitting the real `/verify-otp` form (so `@supabase/ssr` cookies were set the production way, not synthesized). All pages 200, all titles correct, real data rendered (8 amenities, 6 FAQs, 10 menu items, 6 services on public surfaces; arrivals tile + booking list + audit log populated on staff/admin surfaces). Two findings fixed: (1) `app/(admin)/admin/gallery/page.tsx:53` had `encType="multipart/form-data"` on a `<form action={uploadGalleryImage}>` — React 19 server actions handle multipart automatically, the explicit prop triggered a console warning. Removed; codebase-wide grep for `encType=` now returns zero. (2) `next.config.ts` — added `devIndicators.position: "bottom-right"` so the floating Next.js indicator stops overlapping the `Rs. X / night` price text in the lower-left of `/rooms/<slug>` cards. Verified visually via re-screenshot. Test script lives at `scripts/e2e-test.mjs`; screenshots written to `screenshots/` (not committed).
- 2026-05-28 — **Audit + seed pass.** Code audit of all guest/staff/admin flows: only one real bug found — `app/(admin)/admin/reviews/actions.ts` wrapped its success-path `redirect()` inside a `try/catch`, so the catch swallowed `NEXT_REDIRECT` and re-emitted as an error redirect. Refresh button always landed on error URL even on success. Fixed by pulling the redirect outside the try. Auto-redirect added to `/verify-otp` for users with an existing session (`signInWithOtp` doesn't create a session, only `verifyOtp` does, so this only affects already-signed-in revisits — the booking flow's form still renders for fresh OTP entries). Promoted `sndpbhujl168@gmail.com` to `super_admin` for end-to-end admin testing. Seeded operational CMS content via Management API: 8 amenities, 6 FAQs, 10 food items across 4 categories, 6 services across all 5 service_category enum values, and 4 home page_sections (hero / text / faq / cta) so `/` renders with content. Testimonials intentionally NOT seeded (impersonation risk with fabricated authors) — admin can add via `/admin/testimonials`. Renamed `RESEND_FROM_EMAIL` once more in change-log clarification: was set to `onboarding@resend.dev` for dev SMTP; Supabase Auth is independently wired to Resend SMTP with `smtp_admin_email=onboarding@resend.dev` and `smtp_sender_name='Hari Bijog'`.
- 2026-05-28 — **Resend OTP affordance on `/verify-otp`.** Added a "Didn't get the code? Resend" submit button under the verify form that re-invokes `requestOtp` (same email passed via hidden input). `requestOtp` now honors a `from=resend` form field and appends `resent=1` to the redirect; the page shows a green "A fresh code is on its way" banner when that flag is set and there's no error. Always-visible, not error-gated — handles both "wrong code typed" and "email never arrived" cases with one control. No new action; reuses the existing `requestOtp` server action.
- 2026-05-28 — **OTP not-working diagnosis + fix.** `npm run check` revealed migrations 0001–0007 were never applied to the live Supabase project (`PGRST205` on `site_settings`) and only one user exists in `auth.users` — `/login` uses `shouldCreateUser:false` so OTP is silently dropped for any other email. Filled `SESSION_COOKIE_SECRET` (was empty, would have thrown at booking finalize). Swapped `RESEND_FROM_EMAIL` from `admin@example.com` → `onboarding@resend.dev` (was a reserved IANA domain; Resend would have rejected). Bundled all 7 migrations into `supabase/migrations/_bundle.sql` and applied them via the Supabase Management API (`POST /v1/projects/{ref}/database/query`, HTTP 201). `site_settings` now resolves. Verified the **Magic Link** email template was already customized to render `{{ .Token }}`, but a test OTP send (`create_user:true`) revealed Supabase routes new-user signups through the **Confirmation** template, which still used `{{ .ConfirmationURL }}` — recipients got a clickable link instead of a 6-digit code, and `/verify-otp` couldn't accept it. Patched `mailer_templates_confirmation_content` + `mailer_subjects_confirmation` via Management API to render `{{ .Token }}` so the booking signup flow now produces a code-based email. Confirmed via `npm run check` + test send + auth_logs. Renamed hotel to "Hotel Vardani" via `site_settings` PATCH. Outstanding for v1: replace `onboarding@resend.dev` with a Resend-verified domain (Gmail aggressively spams the shared sender); revoke the dev Personal Access Token used during this session.
