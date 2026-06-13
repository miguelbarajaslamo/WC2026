-- Player stats doubled (cards/goals) for the same reason match events did:
-- the unique keys included the display name, which gets enriched between syncs
-- ("J. Alonso" → "Junior Alonso"), so one player_id landed in two rows. Re-key
-- both tables on the stable numeric player_id.

-- match_player_stats: keep one row per (match_id, player_id) — prefer the most
-- recently updated, then the longer (fuller) name.
delete from public.match_player_stats t
where t.player_id is not null
  and exists (
    select 1
    from public.match_player_stats t2
    where t2.match_id = t.match_id
      and t2.player_id = t.player_id
      and (
        t2.updated_at > t.updated_at
        or (t2.updated_at = t.updated_at
            and length(t2.player_name) > length(t.player_name))
        or (t2.updated_at = t.updated_at
            and length(t2.player_name) = length(t.player_name)
            and t2.ctid < t.ctid)
      )
  );

alter table public.match_player_stats
  drop constraint if exists match_player_stats_match_id_team_id_player_name_key;

create unique index if not exists match_player_stats_match_player_idx
  on public.match_player_stats (match_id, player_id);

-- tournament_player_stat_snapshots is fully derived from the above; the recalc
-- recomputes the values, this just collapses the duplicate rows and re-keys.
delete from public.tournament_player_stat_snapshots t
where t.player_id is not null
  and exists (
    select 1
    from public.tournament_player_stat_snapshots t2
    where t2.team_id = t.team_id
      and t2.player_id = t.player_id
      and t2.ctid < t.ctid
  );

alter table public.tournament_player_stat_snapshots
  drop constraint if exists tournament_player_stat_snapshots_player_name_team_id_key;

create unique index if not exists tournament_player_stat_player_idx
  on public.tournament_player_stat_snapshots (team_id, player_id);
