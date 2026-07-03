alter table public.predictions
  add column if not exists score_prediction_enabled boolean not null default false;
