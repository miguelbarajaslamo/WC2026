create extension if not exists pgcrypto;

create type public.scoring_mode as enum ('traditional', 'pot');
create type public.match_status as enum (
  'scheduled',
  'live',
  'halftime',
  'finished',
  'postponed',
  'cancelled'
);
create type public.predicted_result as enum ('home', 'draw', 'away');
create type public.member_role as enum ('admin', 'player');

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prize_note text,
  scoring_mode public.scoring_mode not null default 'traditional',
  scoring_locked_at timestamptz,
  lock_minutes_before_kickoff integer not null default 15,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#064e3b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create table public.teams (
  id bigint primary key,
  name text not null,
  country_code text,
  flag_url text
);

create table public.matches (
  id bigint primary key,
  api_football_fixture_id bigint unique,
  home_team_id bigint references public.teams(id),
  away_team_id bigint references public.teams(id),
  stage text not null,
  group_name text,
  kickoff_at timestamptz not null,
  prediction_lock_at timestamptz not null,
  status public.match_status not null default 'scheduled',
  elapsed_minutes integer,
  home_score integer,
  away_score integer,
  winner public.predicted_result,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  predicted_result public.predicted_result not null,
  home_score integer not null check (home_score >= 0 and home_score <= 30),
  away_score integer not null check (away_score >= 0 and away_score <= 30),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, match_id, user_id)
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id bigint not null references public.matches(id) on delete cascade,
  provider_event_id text,
  elapsed_minutes integer,
  team_id bigint references public.teams(id),
  player_name text,
  assist_name text,
  event_type text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (match_id, provider_event_id)
);

create table public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id bigint references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scoring_mode public.scoring_mode not null,
  points numeric(8, 2) not null default 0,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.pools enable row level security;
alter table public.profiles enable row level security;
alter table public.pool_members enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.match_events enable row level security;
alter table public.score_snapshots enable row level security;

create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "members can read their pools"
  on public.pools for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = pools.id
        and pool_members.user_id = auth.uid()
    )
  );

create policy "members can read pool memberships"
  on public.pool_members for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members own_membership
      where own_membership.pool_id = pool_members.pool_id
        and own_membership.user_id = auth.uid()
    )
  );

create policy "authenticated users can read teams and matches"
  on public.teams for select
  to authenticated
  using (true);

create policy "authenticated users can read matches"
  on public.matches for select
  to authenticated
  using (true);

create policy "authenticated users can read match events"
  on public.match_events for select
  to authenticated
  using (true);

create policy "users can read own predictions before lock"
  on public.predictions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
        and matches.prediction_lock_at <= now()
    )
  );

create policy "users can upsert own unlocked predictions"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
        and matches.prediction_lock_at > now()
    )
  );

create policy "users can update own unlocked predictions"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
        and matches.prediction_lock_at > now()
    )
  )
  with check (user_id = auth.uid());

create policy "members can read score snapshots"
  on public.score_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = score_snapshots.pool_id
        and pool_members.user_id = auth.uid()
    )
  );
