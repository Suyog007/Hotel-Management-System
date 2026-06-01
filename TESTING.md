# Testing

Four tiers, fastest → slowest. The first two run anywhere with zero external
state; the last two need a database and must **never** point at production.

## 1. Static checks (no runtime)

```bash
npm run type-check   # tsc --noEmit — 0 errors gate
npm run lint         # next lint — 0 errors
npm run build        # next build — full production compile
```

## 2. Unit tests — `npm test` (Vitest)

Pure logic + mocked-DB data logic. No network, no real Supabase, no env beyond a
test secret injected by `test/setup.ts`. 81 tests across:

| Area | File | What it locks down |
|------|------|--------------------|
| Pricing | `test/pricing.test.ts` | nights math, tax/service layering, rounding |
| Refunds | `test/cancellation.test.ts` | tier selection, thresholds, past-due clamp |
| Signed cookies | `test/signed-cookie.test.ts` | HMAC round-trip, tamper/secret rejection |
| Availability | `test/availability.test.ts` | overlap filtering via a chainable client stub |
| Booking OTP | `test/booking-otp.test.ts` | hash-not-plaintext, expiry, attempt lockout |
| Validation | `test/validation.test.ts` | Zod schemas: booking form, rooms, auth, sections |
| Status badges | `test/badge.test.ts` | enum → variant/label mapping |
| `cn()` | `test/utils.test.ts` | tailwind-merge conflict resolution |

```bash
npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage   # v8 coverage (core logic ~80–100%)
```

## 3. Integration tests — guarded, opt-in (needs a local DB)

`test/integration/*.integration.test.ts` exercise real Postgres behaviour that
can't be mocked. They are **skipped by default** and only run against a
local/throwaway Supabase. Two suites today:

- `double-booking.integration.test.ts` — the overlap **exclusion constraint**
  (migration 0005): overlapping bookings on a room are rejected, adjacent ones
  allowed.
- `rls.integration.test.ts` — **RLS enforcement** (migration 0002): the anon
  surface (public catalog readable; `otp_verifications`/`audit_logs`/templates
  hidden; writes rejected), service-role bypass, and **role-based
  authorization** — a guest sees only their own booking, staff can read any and
  perform the status write that check-in/out relies on, guests cannot.

### One-time setup (requires Docker Desktop)

```bash
# 1. Install Docker Desktop and start it.
# 2. Boot local Supabase + apply every migration and the 0003 seed:
npx supabase start          # prints API URL + anon/service_role keys
npx supabase db reset       # applies migrations 0001..0011 + seed
```

`supabase/config.toml` is already committed (via `supabase init`), so `start`
works out of the box.

### Run

```bash
# Use the keys printed by `supabase start` (local defaults shown):
RUN_DB_TESTS=1 \
TEST_SUPABASE_URL=http://127.0.0.1:54321 \
TEST_SUPABASE_ANON_KEY=<local anon key> \
TEST_SUPABASE_SERVICE_KEY=<local service_role key> \
npm run test:integration
```

PowerShell:

```powershell
$env:RUN_DB_TESTS="1"; $env:TEST_SUPABASE_URL="http://127.0.0.1:54321"
$env:TEST_SUPABASE_ANON_KEY="<local anon key>"; $env:TEST_SUPABASE_SERVICE_KEY="<local service_role key>"
npm run test:integration
```

Every suite creates and then deletes its own rows/users. **Never** point
`TEST_SUPABASE_URL` at a project you care about.

## 4. End-to-end — Playwright (`e2e/`)

Public-surface smoke tests + auth redirects. Requires the test runner and
browsers (not yet installed):

```bash
npm i -D @playwright/test
npx playwright install
npm run test:e2e        # boots `npm run dev` and drives a real browser
```

- `e2e/public-smoke.spec.ts` — every public route returns < 400, home header
  renders, `/dashboard` + `/admin` redirect to `/login` when logged out. Runs
  anywhere; point it at dev/staging via `E2E_BASE_URL`, never production.
- `e2e/dashboard.auth.spec.ts` — **authenticated** flow: mints a real OTP via
  the admin API, drives the `/verify-otp` form, and confirms a receptionist
  reaches `/dashboard/bookings`. Skipped unless `RUN_DB_TESTS=1` +
  `TEST_SUPABASE_URL`/`TEST_SUPABASE_SERVICE_KEY` point at a **local** Supabase
  (it creates and deletes a user). Run the local app against that same local
  Supabase, then `npm run test:e2e`.

## Not covered (and why)

- **Server actions end-to-end** (booking finalize, check-in/out, staff invite) —
  need an authenticated session + DB; cover via the integration tier against a
  local Supabase, or manually with `/verify` per `BUILD_PLAN.md` checklists.
- **Email/SMTP delivery** — `lib/email.ts` is a thin transport wrapper; mocked
  in unit tests, verified manually (codes arrive) per the env checklist.
- **RLS policy enforcement** — best asserted in the integration tier with anon
  vs service-role clients; a stub is the natural next addition.
