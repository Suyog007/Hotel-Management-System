-- Table-level GRANTs for anon/authenticated/service_role.
--
-- None of 0001-0011 grant table privileges, so a database built from these
-- migrations alone (fresh clone, staging, disaster recovery, local Docker)
-- denies anon/authenticated/service_role access to every table — even
-- though RLS policies (0002) are correct. Table-level GRANTs and RLS are
-- separate gates; both must be open. Production has working grants today,
-- but they aren't captured in any migration file, so this closes that gap.
--
-- RLS stays the real access-control layer: every table already has RLS
-- enabled with default-deny for any role with no matching policy, so these
-- broad grants don't widen what a role can actually see or write.

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Keep future tables covered automatically, matching this migration's intent
-- for anything 0013+ adds without its own explicit GRANT.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
