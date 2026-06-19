-- Starting XIs per match/team, fetched from API-Football in the hour before
-- kickoff. Players are stored as jsonb: [{id,name,number,pos,grid,starter}].
create table if not exists public.match_lineups (
  match_id text not null references public.matches(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  formation text,
  coach text,
  players jsonb not null default '[]',
  fetched_at timestamptz not null default now(),
  primary key (match_id, team_id)
);

alter table public.match_lineups enable row level security;

drop policy if exists "authenticated can read lineups" on public.match_lineups;
create policy "authenticated can read lineups"
  on public.match_lineups for select
  to authenticated
  using (true);

-- Live updates so the lineup tab fills in when the XI arrives.
do $$
begin
  alter publication supabase_realtime add table public.match_lineups;
exception when duplicate_object then null;
end $$;

-- Poll for lineups every minute; the function self-skips once a match's XI is
-- stored and when nothing is in the pre-kickoff window.
select public.schedule_world_cup_sync('world-cup-lineups-sync', '* * * * *', 'lineups');
