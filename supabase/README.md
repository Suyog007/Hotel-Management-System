# Supabase

Database schema, RLS policies, and seed data for the hotel system.

## Layout

```
supabase/
  migrations/
    0001_initial_schema.sql   Enums, tables, indexes, triggers
    0002_rls_policies.sql     Helper functions + RLS policies on every table
    0003_seed_data.sql        Singleton rows + cancellation tiers + templates
```

## Applying migrations

### Option A — Supabase CLI (recommended)

1. Install: https://supabase.com/docs/guides/cli
2. Link the local repo to your Supabase project:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
3. Push migrations:
   ```bash
   supabase db push
   ```

### Option B — SQL editor (no CLI)

Open each file in the Supabase Dashboard → SQL editor and run **in order**:
`0001` → `0002` → `0003`. They are idempotent for the seed (Option 3 uses
`on conflict do nothing`); the schema migrations expect a clean database.

## Regenerating TypeScript types

After applying migrations, generate types:

```bash
npm run db:types
```

That writes `types/supabase.ts`. Update `types/database.ts` to re-export from
there (it is currently a stub).

## Bootstrap a super admin

Sign-in uses `shouldCreateUser: false` — staff can't self-register. To create
the first super admin:

1. Apply migrations.
2. In **Supabase Dashboard → Authentication → Users → Add user**, create the
   admin's email account (or invite by email — either works).
3. The `handle_new_auth_user` trigger inserts a corresponding row into
   `profiles` with `role = 'guest'`. Promote them in the SQL editor:

   ```sql
   update profiles set role = 'super_admin' where lower(email) = lower('admin@example.com');
   ```

4. **Configure Supabase Auth to send 6-digit codes (not magic links)**:
   Dashboard → Authentication → Email Templates → **Magic Link**. Replace
   the `{{ .ConfirmationURL }}` link with the `{{ .Token }}` placeholder
   so the email contains the code itself. (Supabase reuses the same flow
   for `signInWithOtp({ email })` either way; the difference is what the
   template renders.)

5. *(Optional, recommended)* Dashboard → Project Settings → Auth → **SMTP**
   — set Resend as the SMTP provider so OTP emails go through the same
   sender as transactional mail.

## Key design notes

- **profiles is decoupled from auth.users.** `auth_user_id` is `NULL` for
  walk-in stubs created by staff. The `handle_new_auth_user()` trigger links
  a new auth user to any existing stub profile that matches by email.
- **OTP is email-only.** `otp_verifications.email` is the lookup key. Phone
  is collected on the booking form for staff contact, not for OTP delivery.
- **Pricing is snapshotted on the booking.** Later admin price edits do not
  retroactively change existing reservations.
- **Refunds are computed, not moved.** `refund_amount_due` is the system's
  recommendation; the admin records `refunded_amount` + `refund_reference`
  after settling the payment out-of-band.
- **Service role bypasses RLS.** Use `lib/supabase/admin.ts` only inside
  webhooks, cron jobs, OTP issuance, and admin invitations.
