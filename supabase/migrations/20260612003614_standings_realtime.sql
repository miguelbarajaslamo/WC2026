-- Make sure standings changes reach clients via realtime: the Groups view
-- invalidates on this table so cron/sync updates render without a manual
-- refresh. No-op if the table is already in the publication.
do $$
begin
  alter publication supabase_realtime add table public.standings;
exception when duplicate_object then null;
end $$;
