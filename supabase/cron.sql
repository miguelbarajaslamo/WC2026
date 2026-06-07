-- Run after deploying the sync-world-cup Edge Function.
-- Replace <PROJECT_REF> and <CRON_SECRET> before executing.

select cron.schedule(
  'world-cup-live-sync',
  '* * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/sync-world-cup?mode=live',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

select cron.schedule(
  'world-cup-reference-sync',
  '0 */6 * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/sync-world-cup?mode=reference',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

select cron.schedule(
  'world-cup-squad-sync',
  '20 3 * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/sync-world-cup?mode=squads',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <CRON_SECRET>',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

select cron.schedule(
  'world-cup-post-match-sync',
  '*/30 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/sync-world-cup?mode=post-match',
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
