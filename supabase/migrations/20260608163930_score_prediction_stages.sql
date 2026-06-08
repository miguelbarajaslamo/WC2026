-- Stages that use full score prediction. Empty (default) = every stage is
-- result-only (1X2). Admins opt specific stages into score prediction.
alter table public.pools
  add column if not exists score_prediction_stages text[] not null default '{}'::text[];
