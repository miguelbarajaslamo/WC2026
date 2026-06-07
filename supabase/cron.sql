-- Run after deploying the sync-world-cup Edge Function.
-- Replace <PROJECT_REF> and <CRON_SECRET> before executing.

select cron.schedule(
  'world-cup-live-sync',
  '* * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/sync-world-cup',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

select cron.schedule(
  'world-cup-deadline-notifications',
  '*/5 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/send-deadline-notifications',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);
