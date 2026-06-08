-- Pre-tournament (season 2026 national-team) per-player stats for the squad
-- view toggle. { games, minutes, goals, assists, yellow, red, saves, rating }.
alter table public.team_squad_members
  add column if not exists pre_wc_stats jsonb not null default '{}'::jsonb;
