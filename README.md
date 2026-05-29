# Hotel Management System

Next.js 15 + Supabase hotel management system for a single property.
Architecture spec: [`docs/hotel-system-architecture.docx.pdf`](./docs/hotel-system-architecture.docx.pdf).
Build progress: [`BUILD_PLAN.md`](./BUILD_PLAN.md).

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind + shadcn/ui
- **Supabase** Postgres + Auth + Storage + Realtime
- **Payments:** Khalti + eSewa (Nepal) + pay-at-hotel *(deferred — pay-at-hotel only for v1)*
- **Email:** Gmail SMTP / Brevo / Resend (priority chain in `lib/email.ts`)
- **Deploy:** Vercel + Supabase Pro

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project at https://supabase.com and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service role key → `SUPABASE_SERVICE_ROLE_KEY`
3. Copy env template and fill in values:
   ```bash
   cp .env.example .env
   ```
4. Apply database migrations — see [`supabase/README.md`](./supabase/README.md).
5. (Optional) Generate types after migrations are applied:
   ```bash
   npm run db:types
   ```
   then update `types/database.ts` to re-export from the generated file.
6. Run the dev server:
   ```bash
   npm run dev
   ```

## Project layout (after Phase 1)

```
app/
  (auth)/login, verify-otp/   Auth shells (full flow in Phase 3)
  layout.tsx                  Root layout, reads branding from DB
  page.tsx                    Public homepage placeholder
lib/
  supabase/{client,server,middleware,admin}.ts
  utils.ts                    cn() helper
supabase/
  migrations/                 SQL migrations (schema, RLS, seed)
  README.md                   How to apply migrations
types/
  database.ts                 Stub — regenerate with npm run db:types
middleware.ts                 Role-based route gate
BUILD_PLAN.md                 Phase-by-phase todo list + constraints
docs/
  hotel-system-architecture.docx.pdf
```

## Scripts

| Command            | What it does                                        |
|--------------------|-----------------------------------------------------|
| `npm run dev`      | Next.js dev server on http://localhost:4000         |
| `npm run build`    | Production build                                    |
| `npm run start`    | Run the production build                            |
| `npm run lint`     | ESLint                                              |
| `npm run type-check` | `tsc --noEmit`                                    |
| `npm run db:types` | Generate Supabase types (requires linked CLI)       |
| `npm run check`    | Diagnose env config + verify Supabase connectivity  |

## Working on this codebase

- `BUILD_PLAN.md` is the source of truth for what's done and what's next. **Update it as you go.**
- Re-read the "What NOT to do" section in `BUILD_PLAN.md` before adding anything — there are real scope boundaries (no SMS OTP, no in-app review writing, no automatic refunds, etc.).
- All text content is **English only** at v1. Multi-language is deferred per the architecture doc.
