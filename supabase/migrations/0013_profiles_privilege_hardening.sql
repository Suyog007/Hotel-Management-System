-- Close the profiles self-update privilege-escalation hole + harden the
-- role helpers so deactivation is enforced at the DB layer.
--
-- Background: 0002's "profiles self update" policy has
--   using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid())
-- which lets any authenticated user PATCH their own row's `role` to
-- 'super_admin' (0012 grants UPDATE to authenticated, and the WITH CHECK
-- only re-verifies row ownership, not which columns changed). The RLS
-- policy alone can't express "you may update this row but not these
-- columns", so we enforce it with a BEFORE UPDATE trigger.

set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trigger: forbid changes to privileged columns except by super admins
--    or server-side/service-role paths (which have no auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function enforce_profiles_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role / admin-client paths (staff invites, stub-profile creation,
  -- walk-ins) run without a JWT, so auth.uid() is null — allow them. Super
  -- admins may also change these columns. Everyone else must leave
  -- role / is_active / is_stub exactly as they were.
  if auth.uid() is null or is_super_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.is_stub is distinct from old.is_stub then
    raise exception
      'not authorized to change role, is_active, or is_stub on your own profile';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on profiles;
create trigger profiles_protect_privileged_columns
  before update on profiles
  for each row
  execute function enforce_profiles_privileged_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enforce is_active in the role helpers (defense in depth).
--    Previously a deactivated staffer's live session kept full privileges on
--    any path not fronted by the middleware is_active check. Now RLS itself
--    treats a deactivated account as having no staff role.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    exists(
      select 1 from profiles
      where auth_user_id = auth.uid()
        and is_active
        and role in ('receptionist', 'manager', 'super_admin')
    ),
    false
  );
$$;

create or replace function is_manager_or_above() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    exists(
      select 1 from profiles
      where auth_user_id = auth.uid()
        and is_active
        and role in ('manager', 'super_admin')
    ),
    false
  );
$$;

create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    exists(
      select 1 from profiles
      where auth_user_id = auth.uid()
        and is_active
        and role = 'super_admin'
    ),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Guard rails on refund money columns (no negative amounts).
--    Only trusted server code writes these today, but the CHECK makes a
--    negative refund impossible even via a future bug.
-- ─────────────────────────────────────────────────────────────────────────────
alter table bookings
  drop constraint if exists bookings_refund_amount_due_nonneg;
alter table bookings
  add constraint bookings_refund_amount_due_nonneg
  check (refund_amount_due is null or refund_amount_due >= 0);

alter table bookings
  drop constraint if exists bookings_refunded_amount_nonneg;
alter table bookings
  add constraint bookings_refunded_amount_nonneg
  check (refunded_amount is null or refunded_amount >= 0);
