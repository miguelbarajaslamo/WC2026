-- Follow a match: subscribers get pushes for kickoff, goals, cards, half-time
-- and full-time. Users manage their own follows directly (RLS below).

create table if not exists public.match_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.match_follows enable row level security;

drop policy if exists "users read own follows" on public.match_follows;
create policy "users read own follows"
  on public.match_follows for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users add own follows" on public.match_follows;
create policy "users add own follows"
  on public.match_follows for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users remove own follows" on public.match_follows;
create policy "users remove own follows"
  on public.match_follows for delete
  to authenticated
  using (user_id = auth.uid());

-- Live-match alerts need a tighter loop than 5 minutes: run the notification
-- function every minute (it exits cheaply when nothing is due).
select cron.unschedule('world-cup-deadline-notifications')
where exists (
  select 1 from cron.job where jobname = 'world-cup-deadline-notifications'
);

select cron.schedule(
  'world-cup-deadline-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://mdwssqojxiejeyokuvgg.functions.supabase.co/send-deadline-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
