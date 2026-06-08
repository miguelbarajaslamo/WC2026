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

do $$
begin
  create type public.bonus_pick_type as enum (
    'champion',
    'finalist',
    'top_scorer',
    'most_assists',
    'golden_glove',
    'most_cards_country'
  );
exception when duplicate_object then null;
end $$;

alter type public.bonus_pick_type add value if not exists 'most_cards_country';

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  prize_note text,
  scoring_mode public.scoring_mode not null default 'traditional',
  scoring_locked_at timestamptz,
  bonus_lock_at timestamptz,
  lock_minutes_before_kickoff integer not null default 15,
  created_at timestamptz not null default now()
);

alter table public.pools
  add column if not exists bonus_lock_at timestamptz;

alter table public.pools
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#064e3b',
  avatar_url text,
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

create table if not exists public.players (
  id text primary key,
  name text not null,
  photo_url text,
  nationality text,
  position text,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_squad_members (
  team_id text not null references public.teams(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  shirt_number integer,
  position text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id)
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

create table if not exists public.match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches(id) on delete cascade,
  team_id text references public.teams(id) on delete set null,
  player_id text,
  player_name text not null,
  player_photo text,
  minutes integer not null default 0,
  position text,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  saves integer not null default 0,
  clean_sheets integer not null default 0,
  rating numeric(5, 2),
  provider_freshness_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (match_id, team_id, player_name)
);

alter table public.match_player_stats
  add column if not exists minutes integer not null default 0,
  add column if not exists position text,
  add column if not exists saves integer not null default 0,
  add column if not exists clean_sheets integer not null default 0,
  add column if not exists rating numeric(5, 2),
  add column if not exists provider_freshness_at timestamptz;

create table if not exists public.tournament_player_stat_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id text references public.players(id) on delete set null,
  player_name text not null,
  team_id text references public.teams(id) on delete set null,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  saves integer not null default 0,
  clean_sheets integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (player_name, team_id)
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

create table if not exists public.bonus_pick_options (
  id text primary key,
  type public.bonus_pick_type not null,
  label text not null,
  team_id text references public.teams(id) on delete set null,
  player_id text references public.players(id) on delete set null,
  player_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bonus_pick_options
  add column if not exists player_id text references public.players(id) on delete set null;

create table if not exists public.bonus_picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.bonus_pick_type not null,
  slot integer not null default 1,
  option_id text not null references public.bonus_pick_options(id) on delete restrict,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, user_id, type, slot)
);

create table if not exists public.bonus_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.bonus_pick_type not null,
  slot integer not null default 1,
  points numeric(8, 2) not null default 0,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, type, slot)
);

alter table public.bonus_score_snapshots
  add column if not exists slot integer not null default 1;

alter table public.bonus_score_snapshots
  drop constraint if exists bonus_score_snapshots_pool_id_user_id_type_key;

create unique index if not exists bonus_score_snapshots_pool_user_type_slot_idx
  on public.bonus_score_snapshots (pool_id, user_id, type, slot);

create table if not exists public.bonus_winners (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  type public.bonus_pick_type not null,
  slot integer not null default 1,
  option_id text not null references public.bonus_pick_options(id) on delete restrict,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (pool_id, type, slot, option_id)
);

alter table public.bonus_winners
  drop constraint if exists bonus_winners_pool_id_type_slot_key;

create unique index if not exists bonus_winners_pool_type_slot_option_idx
  on public.bonus_winners (pool_id, type, slot, option_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text references public.matches(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  url text not null default '/picks',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, match_id, notification_type)
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

create or replace function public.try_world_cup_sync_lock(lock_key bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select pg_try_advisory_lock(lock_key);
$$;

create or replace function public.release_world_cup_sync_lock(lock_key bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select pg_advisory_unlock(lock_key);
$$;

-- Membership check used by the pool_members RLS policy. It must be
-- security definer so the lookup bypasses RLS on pool_members; otherwise a
-- policy on pool_members that queries pool_members recurses infinitely
-- (Postgres error 42P17).
create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.pool_members
    where pool_members.pool_id = p_pool_id
      and pool_members.user_id = auth.uid()
  );
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
alter table public.players enable row level security;
alter table public.team_squad_members enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.match_events enable row level security;
alter table public.match_player_stats enable row level security;
alter table public.tournament_player_stat_snapshots enable row level security;
alter table public.standings enable row level security;
alter table public.score_snapshots enable row level security;
alter table public.bonus_pick_options enable row level security;
alter table public.bonus_picks enable row level security;
alter table public.bonus_score_snapshots enable row level security;
alter table public.bonus_winners enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_jobs enable row level security;
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
  using (public.is_pool_member(pool_id));

drop policy if exists "authenticated users can read teams" on public.teams;
create policy "authenticated users can read teams"
  on public.teams for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read players" on public.players;
create policy "authenticated users can read players"
  on public.players for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read squad members" on public.team_squad_members;
create policy "authenticated users can read squad members"
  on public.team_squad_members for select
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

drop policy if exists "authenticated users can read match player stats" on public.match_player_stats;
create policy "authenticated users can read match player stats"
  on public.match_player_stats for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read tournament player stats" on public.tournament_player_stat_snapshots;
create policy "authenticated users can read tournament player stats"
  on public.tournament_player_stat_snapshots for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can read standings" on public.standings;
drop policy if exists "members can read standings" on public.standings;
create policy "members can read standings"
  on public.standings for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = standings.pool_id
        and pool_members.user_id = auth.uid()
    )
  );

drop policy if exists "users can read own predictions before lock and all after lock" on public.predictions;
drop policy if exists "pool members can read own predictions before lock and pool predictions after lock" on public.predictions;
create policy "pool members can read own predictions before lock and pool predictions after lock"
  on public.predictions for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = predictions.pool_id
        and pool_members.user_id = auth.uid()
    )
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.matches
        where matches.id = predictions.match_id
          and matches.prediction_lock_at <= now()
      )
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
      select 1 from public.pool_members
      where pool_members.pool_id = predictions.pool_id
        and pool_members.user_id = auth.uid()
    )
    and exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
        and matches.prediction_lock_at > now()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.pool_members
      where pool_members.pool_id = predictions.pool_id
        and pool_members.user_id = auth.uid()
    )
  );

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

drop policy if exists "members can read bonus options" on public.bonus_pick_options;
create policy "members can read bonus options"
  on public.bonus_pick_options for select
  to authenticated
  using (true);

drop policy if exists "users can read own bonus picks" on public.bonus_picks;
drop policy if exists "pool members can read own bonus picks before lock and pool bonus picks after lock" on public.bonus_picks;
create policy "pool members can read own bonus picks before lock and pool bonus picks after lock"
  on public.bonus_picks for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = bonus_picks.pool_id
        and pool_members.user_id = auth.uid()
    )
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.pools
        where pools.id = bonus_picks.pool_id
          and coalesce(pools.bonus_lock_at, 'infinity'::timestamptz) <= now()
      )
    )
  );

drop policy if exists "users can upsert own bonus picks" on public.bonus_picks;
create policy "users can upsert own bonus picks"
  on public.bonus_picks for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.pool_members
      where pool_members.pool_id = bonus_picks.pool_id
        and pool_members.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pools
      where pools.id = bonus_picks.pool_id
        and coalesce(pools.bonus_lock_at, 'infinity'::timestamptz) > now()
    )
  );

drop policy if exists "users can update own bonus picks" on public.bonus_picks;
create policy "users can update own bonus picks"
  on public.bonus_picks for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.pools
      where pools.id = bonus_picks.pool_id
        and coalesce(pools.bonus_lock_at, 'infinity'::timestamptz) > now()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.pool_members
      where pool_members.pool_id = bonus_picks.pool_id
        and pool_members.user_id = auth.uid()
    )
  );

drop policy if exists "members can read bonus score snapshots" on public.bonus_score_snapshots;
create policy "members can read bonus score snapshots"
  on public.bonus_score_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = bonus_score_snapshots.pool_id
        and pool_members.user_id = auth.uid()
    )
  );

drop policy if exists "members can read bonus winners" on public.bonus_winners;
create policy "members can read bonus winners"
  on public.bonus_winners for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = bonus_winners.pool_id
        and pool_members.user_id = auth.uid()
    )
  );

drop policy if exists "users can manage own push subscriptions" on public.push_subscriptions;
create policy "users can manage own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users can read own notification jobs" on public.notification_jobs;
create policy "users can read own notification jobs"
  on public.notification_jobs for select
  to authenticated
  using (user_id = auth.uid());

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

-- Schema drift reconciliation. The production database was created from an
-- early version of this file and never received later columns. `create table
-- if not exists` only creates the (many) missing tables; it does not add
-- missing columns to tables that already exist. These idempotent alters bring
-- those tables up to date.
alter table public.teams add column if not exists short_name text;
alter table public.teams add column if not exists iso2 text;
alter table public.teams add column if not exists group_name text;

alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists city text;
alter table public.matches add column if not exists provider_status_code text;

alter table public.match_events add column if not exists stoppage_minutes integer;

alter table public.profiles
  add column if not exists notification_deadlines boolean not null default true;
alter table public.profiles
  add column if not exists notification_live_scores boolean not null default false;
alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
