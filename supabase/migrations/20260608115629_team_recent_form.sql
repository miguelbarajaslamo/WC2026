-- Per-team recent form (last 5 finished matches), refreshed by
-- scripts/enrich-team-form.mjs. Each entry:
-- { date, competition, opponent, gf, ga, result: 'W'|'D'|'L' }.
alter table public.teams
  add column if not exists recent_form jsonb not null default '[]'::jsonb;
