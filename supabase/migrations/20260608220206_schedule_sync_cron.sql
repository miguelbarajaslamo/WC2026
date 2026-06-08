-- Auto-sync schedule. The edge function authenticates via CRON_SECRET, read
-- from Vault (set separately, never committed) so this migration has no secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.schedule_world_cup_sync(
  job_name text,
  cron_expr text,
  mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  fn_url text := 'https://mdwssqojxiejeyokuvgg.functions.supabase.co/sync-world-cup?mode=' || mode;
begin
  perform cron.schedule(
    job_name,
    cron_expr,
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );$cmd$,
      fn_url
    )
  );
end;
$fn$;

-- live polls every minute; the function self-skips when no match is in play and
-- runs an internal 15s loop while games are live.
select public.schedule_world_cup_sync('world-cup-live-sync', '* * * * *', 'live');
select public.schedule_world_cup_sync('world-cup-reference-sync', '0 */6 * * *', 'reference');
select public.schedule_world_cup_sync('world-cup-form-sync', '30 */6 * * *', 'form');
select public.schedule_world_cup_sync('world-cup-post-match-sync', '15 */6 * * *', 'post-match');
select public.schedule_world_cup_sync('world-cup-squad-sync', '20 3 * * *', 'squads');
