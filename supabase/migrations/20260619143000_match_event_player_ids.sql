alter table public.match_events
  add column if not exists player_id text,
  add column if not exists assist_id text;
