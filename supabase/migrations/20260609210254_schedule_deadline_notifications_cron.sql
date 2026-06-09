-- Schedule the deadline-notification push job. Runs every 5 minutes: the edge
-- function self-skips when no match is locking within the next 2 hours, so the
-- off-peak cost is just a cheap DB query. Authenticates via CRON_SECRET read
-- from Vault, matching the sync cron pattern (no secret committed here).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior copy of this job before (re)scheduling.
select cron.unschedule('world-cup-deadline-notifications')
where exists (
  select 1 from cron.job where jobname = 'world-cup-deadline-notifications'
);

select cron.schedule(
  'world-cup-deadline-notifications',
  '*/5 * * * *',
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
