create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  create type public.scoring_mode as enum ('traditional', 'pot');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.match_status as enum (
    'scheduled',
    'live',
    'halftime',
    'finished',
    'postponed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.predicted_result as enum ('home', 'draw', 'away');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.member_role as enum ('admin', 'player');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sync_status as enum ('ok', 'warning', 'error');
exception when duplicate_object then null;
end $$;

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prize_note text,
  scoring_mode public.scoring_mode not null default 'traditional',
  scoring_locked_at timestamptz,
  lock_minutes_before_kickoff integer not null default 15,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#064e3b',
  notification_deadlines boolean not null default true,
  notification_live_scores boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  short_name text not null,
  country_code text,
  iso2 text,
  group_name text,
  flag_url text
);

create table if not exists public.matches (
  id text primary key,
  api_football_fixture_id bigint unique,
  home_team_id text references public.teams(id),
  away_team_id text references public.teams(id),
  stage text not null,
  group_name text,
  venue text,
  city text,
  kickoff_at timestamptz not null,
  prediction_lock_at timestamptz not null,
  status public.match_status not null default 'scheduled',
  provider_status_code text,
  elapsed_minutes integer,
  home_score integer,
  away_score integer,
  winner public.predicted_result,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  predicted_result public.predicted_result not null,
  home_score integer not null check (home_score >= 0 and home_score <= 30),
  away_score integer not null check (away_score >= 0 and away_score <= 30),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, match_id, user_id)
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches(id) on delete cascade,
  provider_event_id text,
  elapsed_minutes integer,
  stoppage_minutes integer,
  team_id text references public.teams(id),
  player_name text,
  assist_name text,
  event_type text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (match_id, provider_event_id)
);

create table if not exists public.standings (
  pool_id uuid references public.pools(id) on delete cascade,
  team_id text references public.teams(id) on delete cascade,
  group_name text not null,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  points integer not null default 0,
  qualification text not null default 'possible',
  updated_at timestamptz not null default now(),
  primary key (pool_id, team_id)
);

create table if not exists public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id text references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scoring_mode public.scoring_mode not null,
  points numeric(8, 2) not null default 0,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (pool_id, match_id, user_id, scoring_mode)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'api-football',
  status public.sync_status not null default 'ok',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  requests_used integer not null default 0,
  message text not null default '',
  error jsonb
);

create table if not exists public.admin_overrides (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.pools(id) on delete cascade,
  match_id text references public.matches(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  override_type text not null,
  payload jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1),
      'Player'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.pools enable row level security;
alter table public.profiles enable row level security;
alter table public.pool_members enable row level security;
alter table public.invites enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.match_events enable row level security;
alter table public.standings enable row level security;
alter table public.score_snapshots enable row level security;
alter table public.sync_runs enable row level security;
alter table public.admin_overrides enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "profiles readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "members can read their pools" on public.pools;
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

drop policy if exists "members can read pool memberships" on public.pool_members;
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

drop policy if exists "authenticated users can read teams" on public.teams;
create policy "authenticated users can read teams"
  on public.teams for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read matches" on public.matches;
create policy "authenticated users can read matches"
  on public.matches for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read match events" on public.match_events;
create policy "authenticated users can read match events"
  on public.match_events for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read standings" on public.standings;
create policy "authenticated users can read standings"
  on public.standings for select
  to authenticated
  using (true);

drop policy if exists "users can read own predictions before lock and all after lock" on public.predictions;
create policy "users can read own predictions before lock and all after lock"
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

drop policy if exists "users can insert own unlocked predictions" on public.predictions;
create policy "users can insert own unlocked predictions"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.pool_members
      where pool_members.pool_id = predictions.pool_id
        and pool_members.user_id = auth.uid()
    )
    and exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
        and matches.prediction_lock_at > now()
    )
  );

drop policy if exists "users can update own unlocked predictions" on public.predictions;
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

drop policy if exists "members can read score snapshots" on public.score_snapshots;
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

drop policy if exists "admins can read sync runs" on public.sync_runs;
create policy "admins can read sync runs"
  on public.sync_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.user_id = auth.uid()
        and pool_members.role = 'admin'
    )
  );

drop policy if exists "admins can read overrides" on public.admin_overrides;
create policy "admins can read overrides"
  on public.admin_overrides for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = admin_overrides.pool_id
        and pool_members.user_id = auth.uid()
        and pool_members.role = 'admin'
    )
  );
