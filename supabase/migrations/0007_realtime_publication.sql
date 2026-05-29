-- Subscribe chat + notifications tables to Supabase Realtime.
-- Idempotent: ignores duplicate-object errors if the table is already in the
-- publication (Supabase Cloud often adds tables automatically when realtime
-- is enabled from the dashboard).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table conversations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
