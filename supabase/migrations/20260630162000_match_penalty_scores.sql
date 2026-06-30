alter table public.matches
  add column if not exists home_penalty_score integer check (
    home_penalty_score is null or home_penalty_score >= 0
  ),
  add column if not exists away_penalty_score integer check (
    away_penalty_score is null or away_penalty_score >= 0
  );
