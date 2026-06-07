import { startOfDay } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supportedBonusPickTypes } from "@/lib/types";
import type {
  BonusPick,
  BonusPickOption,
  BonusScoreSnapshot,
  BootstrapData,
  AdminOverride,
  LeaderboardRow,
  Match,
  MatchEvent,
  MatchPlayerStat,
  Pool,
  PoolMember,
  Prediction,
  Player,
  Profile,
  StandingRow,
  SyncRun,
  Team,
  TeamSquadMember,
  TournamentPlayerStatSnapshot,
} from "@/lib/types";
import {
  aggregateCategoryLeaderboards,
  type PlayerStatSource,
} from "@/lib/stats/category-leaderboards";

type PoolMemberRow = {
  joined_at: string;
  pool_id: string;
  role: "admin" | "player";
  user_id: string;
};

type PoolRow = {
  bonus_lock_at: string | null;
  id: string;
  lock_minutes_before_kickoff: number;
  name: string;
  prize_note: string | null;
  scoring_locked_at: string | null;
  scoring_mode: "traditional" | "pot";
};

type ProfileRow = {
  avatar_color: string;
  display_name: string;
  id: string;
  notification_deadlines: boolean | null;
  notification_live_scores: boolean | null;
};

type TeamRow = {
  flag_url: string | null;
  group_name: string | null;
  id: string;
  iso2: string | null;
  name: string;
  short_name: string;
};

type PlayerRow = {
  id: string;
  name: string;
  nationality: string | null;
  photo_url: string | null;
  position: string | null;
};

type TeamSquadMemberRow = {
  active: boolean | null;
  player_id: string;
  position: string | null;
  shirt_number: number | null;
  team_id: string;
};

type MatchRow = {
  api_football_fixture_id: number | null;
  away_score: number | null;
  away_team_id: string;
  city: string | null;
  elapsed_minutes: number | null;
  group_name: string | null;
  home_score: number | null;
  home_team_id: string;
  id: string;
  kickoff_at: string;
  last_synced_at: string | null;
  prediction_lock_at: string;
  provider_status_code: string | null;
  stage: string;
  status: Match["status"];
  venue: string | null;
  winner: Match["winner"] | null;
};

type PredictionRow = {
  away_score: number;
  home_score: number;
  id: string;
  locked_at: string | null;
  match_id: string;
  pool_id: string;
  predicted_result: Prediction["predictedResult"];
  updated_at: string;
  user_id: string;
};

type MatchEventRow = {
  assist_name: string | null;
  detail: string | null;
  elapsed_minutes: number | null;
  event_type: MatchEvent["type"];
  id: string;
  match_id: string;
  player_name: string | null;
  stoppage_minutes: number | null;
  team_id: string;
};

type MatchPlayerStatRow = {
  assists: number | null;
  clean_sheets: number | null;
  goals: number | null;
  match_id: string;
  minutes: number | null;
  player_id: string | null;
  player_name: string;
  position: string | null;
  rating: number | string | null;
  red_cards: number | null;
  saves: number | null;
  team_id: string;
  updated_at: string;
  yellow_cards: number | null;
};

type TournamentPlayerStatSnapshotRow = {
  assists: number | null;
  clean_sheets: number | null;
  goals: number | null;
  player_id: string | null;
  player_name: string;
  red_cards: number | null;
  saves: number | null;
  team_id: string;
  updated_at: string;
  yellow_cards: number | null;
};

type StandingRowRecord = {
  drawn: number;
  goals_against: number;
  goals_for: number;
  group_name: string;
  lost: number;
  played: number;
  points: number;
  qualification: StandingRow["qualification"];
  team_id: string;
  won: number;
};

type ScoreSnapshotRow = {
  match_id: string | null;
  points: number | string;
  reason: string;
  user_id: string;
};

type BonusPickOptionRow = {
  id: string;
  label: string;
  player_id: string | null;
  player_name: string | null;
  team_id: string | null;
  type: string;
};

type BonusPickRow = {
  id: string;
  locked_at: string | null;
  option_id: string;
  pool_id: string;
  slot: number;
  type: string;
  updated_at: string;
  user_id: string;
};

type BonusScoreSnapshotRow = {
  id: string;
  points: number | string;
  pool_id: string;
  reason: string;
  slot: number | null;
  type: string;
  user_id: string;
};

type SyncRunRow = {
  finished_at: string | null;
  id: string;
  message: string | null;
  requests_used: number | null;
  source: string;
  started_at: string;
  status: SyncRun["status"];
};

type AdminOverrideRow = {
  created_at: string;
  created_by: string | null;
  id: string;
  match_id: string | null;
  override_type: string;
  payload: Record<string, unknown>;
  reason: string | null;
};

export class BootstrapAccessError extends Error {
  status = 403;
}

function numberFrom(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

const supportedBonusPickTypeSet = new Set<string>(supportedBonusPickTypes);

function isSupportedBonusPickType(value: string): value is BonusPick["type"] {
  return supportedBonusPickTypeSet.has(value);
}

function mapPool(row: PoolRow): Pool {
  return {
    bonusLockAt: row.bonus_lock_at ?? undefined,
    id: row.id,
    lockMinutesBeforeKickoff: row.lock_minutes_before_kickoff,
    name: row.name,
    prizeNote: row.prize_note ?? "",
    scoringLockedAt: row.scoring_locked_at ?? undefined,
    scoringMode: row.scoring_mode,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    avatarColor: row.avatar_color,
    displayName: row.display_name,
    id: row.id,
    notificationDeadlines: row.notification_deadlines ?? true,
    notificationLiveScores: row.notification_live_scores ?? false,
  };
}

function mapTeam(row: TeamRow): Team {
  return {
    flagUrl: row.flag_url ?? undefined,
    groupName: row.group_name ?? undefined,
    id: row.id,
    iso2: row.iso2 ?? undefined,
    name: row.name,
    shortName: row.short_name,
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    position: row.position ?? undefined,
  };
}

function mapSquadMember(row: TeamSquadMemberRow): TeamSquadMember {
  return {
    active: row.active ?? true,
    playerId: row.player_id,
    position: row.position ?? undefined,
    shirtNumber: row.shirt_number ?? undefined,
    teamId: row.team_id,
  };
}

function mapMatch(row: MatchRow): Match {
  const fallbackFixtureId = Number(row.id);

  return {
    apiFootballFixtureId:
      row.api_football_fixture_id ??
      (Number.isFinite(fallbackFixtureId) ? fallbackFixtureId : 0),
    awayScore: row.away_score ?? undefined,
    awayTeamId: row.away_team_id,
    city: row.city ?? "",
    elapsedMinutes: row.elapsed_minutes ?? undefined,
    groupName: row.group_name ?? undefined,
    homeScore: row.home_score ?? undefined,
    homeTeamId: row.home_team_id,
    id: row.id,
    kickoffAt: row.kickoff_at,
    lastSyncedAt: row.last_synced_at ?? undefined,
    predictionLockAt: row.prediction_lock_at,
    providerStatusCode: row.provider_status_code ?? "",
    stage: row.stage,
    status: row.status,
    venue: row.venue ?? "",
    winner: row.winner ?? undefined,
  };
}

function mapPrediction(row: PredictionRow): Prediction {
  return {
    awayScore: row.away_score,
    homeScore: row.home_score,
    id: row.id,
    lockedAt: row.locked_at ?? undefined,
    matchId: row.match_id,
    poolId: row.pool_id,
    predictedResult: row.predicted_result,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function mapEvent(row: MatchEventRow): MatchEvent {
  return {
    assistName: row.assist_name ?? undefined,
    detail: row.detail ?? undefined,
    id: row.id,
    matchId: row.match_id,
    minute: row.elapsed_minutes ?? 0,
    playerName: row.player_name ?? "",
    stoppageMinute: row.stoppage_minutes ?? undefined,
    teamId: row.team_id,
    type: row.event_type,
  };
}

function mapPlayerStat(row: MatchPlayerStatRow): PlayerStatSource {
  return {
    assists: row.assists ?? 0,
    cleanSheets: row.clean_sheets ?? 0,
    goals: row.goals ?? 0,
    matchId: row.match_id,
    minutes: row.minutes ?? 0,
    playerId: row.player_id ?? undefined,
    playerName: row.player_name,
    position: row.position ?? undefined,
    rating: row.rating === null ? undefined : Number(row.rating),
    redCards: row.red_cards ?? 0,
    saves: row.saves ?? 0,
    teamId: row.team_id,
    updatedAt: row.updated_at,
    yellowCards: row.yellow_cards ?? 0,
  };
}

function mapMatchPlayerStat(row: MatchPlayerStatRow): MatchPlayerStat {
  return {
    assists: row.assists ?? 0,
    cleanSheets: row.clean_sheets ?? 0,
    goals: row.goals ?? 0,
    matchId: row.match_id,
    minutes: row.minutes ?? 0,
    playerId: row.player_id ?? undefined,
    playerName: row.player_name,
    position: row.position ?? undefined,
    rating: row.rating === null ? undefined : Number(row.rating),
    redCards: row.red_cards ?? 0,
    saves: row.saves ?? 0,
    teamId: row.team_id,
    updatedAt: row.updated_at,
    yellowCards: row.yellow_cards ?? 0,
  };
}

function mapPlayerStatSnapshot(
  row: TournamentPlayerStatSnapshotRow,
): TournamentPlayerStatSnapshot {
  return {
    assists: row.assists ?? 0,
    cleanSheets: row.clean_sheets ?? 0,
    goals: row.goals ?? 0,
    playerId: row.player_id ?? undefined,
    playerName: row.player_name,
    redCards: row.red_cards ?? 0,
    saves: row.saves ?? 0,
    teamId: row.team_id,
    updatedAt: row.updated_at,
    yellowCards: row.yellow_cards ?? 0,
  };
}

function mapBonusPick(row: BonusPickRow & { type: BonusPick["type"] }): BonusPick {
  return {
    id: row.id,
    lockedAt: row.locked_at ?? undefined,
    optionId: row.option_id,
    poolId: row.pool_id,
    slot: row.slot,
    type: row.type,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function mapSyncRun(row: SyncRunRow): SyncRun {
  return {
    finishedAt: row.finished_at ?? undefined,
    id: row.id,
    message: row.message ?? "",
    requestsUsed: row.requests_used ?? 0,
    source: row.source,
    startedAt: row.started_at,
    status: row.status,
  };
}

function mapAdminOverride(row: AdminOverrideRow): AdminOverride {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    id: row.id,
    matchId: row.match_id ?? undefined,
    overrideType: row.override_type,
    payload: row.payload,
    reason: row.reason ?? undefined,
  };
}

function buildStandings(rows: StandingRowRecord[]) {
  return rows.reduce<Record<string, StandingRow[]>>((groups, row) => {
    const group = groups[row.group_name] ?? [];
    group.push({
      drawn: row.drawn,
      goalsAgainst: row.goals_against,
      goalsFor: row.goals_for,
      lost: row.lost,
      played: row.played,
      points: row.points,
      qualification: row.qualification,
      teamId: row.team_id,
      won: row.won,
    });
    groups[row.group_name] = group;
    return groups;
  }, {});
}

function buildLeaderboard({
  bonusSnapshots,
  members,
  matches,
  profiles,
  scoreSnapshots,
}: {
  bonusSnapshots: BonusScoreSnapshotRow[];
  members: PoolMember[];
  matches: Match[];
  profiles: Profile[];
  scoreSnapshots: ScoreSnapshotRow[];
}): LeaderboardRow[] {
  const todayStart = startOfDay(new Date()).getTime();
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return members
    .map((member) => {
      const profile = profileById.get(member.userId);
      const matchScores = scoreSnapshots.filter(
        (snapshot) => snapshot.user_id === member.userId,
      );
      const bonusScores = bonusSnapshots.filter(
        (snapshot) => snapshot.user_id === member.userId,
      );
      const points =
        matchScores.reduce((sum, snapshot) => sum + numberFrom(snapshot.points), 0) +
        bonusScores.reduce((sum, snapshot) => sum + numberFrom(snapshot.points), 0);
      const todayPoints = matchScores
        .filter((snapshot) => {
          const match = snapshot.match_id ? matchById.get(snapshot.match_id) : undefined;
          return match ? new Date(match.kickoffAt).getTime() >= todayStart : false;
        })
        .reduce((sum, snapshot) => sum + numberFrom(snapshot.points), 0);

      return {
        avatarColor: profile?.avatarColor ?? "#064e3b",
        displayName: profile?.displayName ?? "Player",
        exactScores: matchScores.filter((snapshot) => snapshot.reason === "exact_score").length,
        movement: 0,
        points,
        rank: 0,
        riskyHits: matchScores.filter((snapshot) => snapshot.reason.includes("pot")).length,
        todayPoints,
        userId: member.userId,
      };
    })
    .sort((left, right) => right.points - left.points)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function requireSingle<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await promise;

  if (error || !data) {
    throw new Error(error?.message ?? "Missing required data");
  }

  return data;
}

async function selectMany<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function buildSupabaseBootstrapData({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<BootstrapData> {
  const { data: currentMembership, error: membershipError } = await supabase
    .from("pool_members")
    .select("pool_id,user_id,role,joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!currentMembership) {
    throw new BootstrapAccessError("You have not joined a pool yet");
  }

  const pool = mapPool(
    await requireSingle<PoolRow>(
      supabase
        .from("pools")
        .select(
          "id,name,prize_note,scoring_mode,scoring_locked_at,bonus_lock_at,lock_minutes_before_kickoff",
        )
        .eq("id", currentMembership.pool_id)
        .single(),
    ),
  );

  const [
    memberRows,
    teams,
    players,
    squadMembers,
    matches,
    events,
    predictions,
    matchPlayerStats,
    playerStatSnapshots,
    standings,
    scoreSnapshots,
    bonusPickOptions,
    bonusPicks,
    bonusScoreSnapshots,
    syncRuns,
    adminOverrides,
  ] = await Promise.all([
    selectMany<PoolMemberRow>(
      supabase
        .from("pool_members")
        .select("pool_id,user_id,role,joined_at")
        .eq("pool_id", pool.id),
    ),
    selectMany<TeamRow>(
      supabase
        .from("teams")
        .select("id,name,short_name,iso2,group_name,flag_url"),
    ),
    selectMany<PlayerRow>(
      supabase
        .from("players")
        .select("id,name,photo_url,nationality,position"),
    ),
    selectMany<TeamSquadMemberRow>(
      supabase
        .from("team_squad_members")
        .select("team_id,player_id,shirt_number,position,active"),
    ),
    selectMany<MatchRow>(
      supabase
        .from("matches")
        .select(
          "id,api_football_fixture_id,home_team_id,away_team_id,stage,group_name,venue,city,kickoff_at,prediction_lock_at,status,provider_status_code,elapsed_minutes,home_score,away_score,winner,last_synced_at",
        ),
    ),
    selectMany<MatchEventRow>(
      supabase
        .from("match_events")
        .select(
          "id,match_id,elapsed_minutes,stoppage_minutes,team_id,player_name,assist_name,event_type,detail",
        ),
    ),
    selectMany<PredictionRow>(
      supabase
        .from("predictions")
        .select(
          "id,pool_id,match_id,user_id,predicted_result,home_score,away_score,locked_at,updated_at",
        )
        .eq("pool_id", pool.id),
    ),
    selectMany<MatchPlayerStatRow>(
      supabase
        .from("match_player_stats")
        .select(
          "match_id,team_id,player_id,player_name,minutes,position,goals,assists,yellow_cards,red_cards,saves,clean_sheets,rating,updated_at",
        ),
    ),
    selectMany<TournamentPlayerStatSnapshotRow>(
      supabase
        .from("tournament_player_stat_snapshots")
        .select(
          "player_id,player_name,team_id,goals,assists,yellow_cards,red_cards,saves,clean_sheets,updated_at",
        ),
    ),
    selectMany<StandingRowRecord>(
      supabase
        .from("standings")
        .select(
          "team_id,group_name,played,won,drawn,lost,goals_for,goals_against,points,qualification",
        )
        .eq("pool_id", pool.id),
    ),
    selectMany<ScoreSnapshotRow>(
      supabase
        .from("score_snapshots")
        .select("user_id,match_id,points,reason")
        .eq("pool_id", pool.id)
        .eq("scoring_mode", pool.scoringMode),
    ),
    selectMany<BonusPickOptionRow>(
      supabase
        .from("bonus_pick_options")
        .select("id,type,label,team_id,player_id,player_name")
        .eq("active", true),
    ),
    selectMany<BonusPickRow>(
      supabase
        .from("bonus_picks")
        .select("id,pool_id,user_id,type,slot,option_id,locked_at,updated_at")
        .eq("pool_id", pool.id),
    ),
    selectMany<BonusScoreSnapshotRow>(
      supabase
        .from("bonus_score_snapshots")
        .select("id,pool_id,user_id,type,slot,points,reason")
        .eq("pool_id", pool.id),
    ),
    selectMany<SyncRunRow>(
      supabase
        .from("sync_runs")
        .select("id,source,status,started_at,finished_at,requests_used,message")
        .order("started_at", { ascending: false })
        .limit(10),
    ),
    selectMany<AdminOverrideRow>(
      supabase
        .from("admin_overrides")
        .select("id,match_id,created_by,override_type,payload,reason,created_at")
        .eq("pool_id", pool.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
  ]);

  const members = memberRows.map((member) => ({
    joinedAt: member.joined_at,
    role: member.role,
    userId: member.user_id,
  }));
  const profiles = await selectMany<ProfileRow>(
    supabase
      .from("profiles")
      .select(
        "id,display_name,avatar_color,notification_deadlines,notification_live_scores",
      )
      .in("id", members.map((member) => member.userId)),
  );
  const mappedMatches = matches.map(mapMatch);
  const mappedProfiles = profiles.map(mapProfile);
  const mappedMembers = members;
  const mappedEvents = events.map(mapEvent);
  const mappedTeams = teams.map(mapTeam);
  const mappedPlayerStats = matchPlayerStats.map(mapPlayerStat);
  const supportedBonusPickOptions = bonusPickOptions.filter(
    (option): option is BonusPickOptionRow & { type: BonusPickOption["type"] } =>
      isSupportedBonusPickType(option.type),
  );
  const supportedBonusPicks = bonusPicks.filter(
    (pick): pick is BonusPickRow & { type: BonusPick["type"] } =>
      isSupportedBonusPickType(pick.type),
  );
  const supportedBonusScoreSnapshots = bonusScoreSnapshots.filter(
    (
      snapshot,
    ): snapshot is BonusScoreSnapshotRow & { type: BonusScoreSnapshot["type"] } =>
      isSupportedBonusPickType(snapshot.type),
  );

  return {
    authMode: "authenticated",
    bonusPickOptions: supportedBonusPickOptions.map((option) => ({
      id: option.id,
      label: option.label,
      playerId: option.player_id ?? undefined,
      playerName: option.player_name ?? undefined,
      teamId: option.team_id ?? undefined,
      type: option.type,
    })),
    bonusPicks: supportedBonusPicks.map(mapBonusPick),
    bonusScoreSnapshots: supportedBonusScoreSnapshots.map((snapshot) => ({
      id: snapshot.id,
      points: numberFrom(snapshot.points),
      poolId: snapshot.pool_id,
      reason: snapshot.reason,
      slot: snapshot.slot ?? 1,
      type: snapshot.type,
      userId: snapshot.user_id,
    })),
    currentMemberRole: currentMembership.role,
    currentUserId: userId,
    adminOverrides: adminOverrides.map(mapAdminOverride),
    events: mappedEvents,
    generatedAt: new Date().toISOString(),
    leaderboard: buildLeaderboard({
      bonusSnapshots: supportedBonusScoreSnapshots,
      matches: mappedMatches,
      members: mappedMembers,
      profiles: mappedProfiles,
      scoreSnapshots,
    }),
    matches: mappedMatches,
    members: mappedMembers,
    matchPlayerStats: matchPlayerStats.map(mapMatchPlayerStat),
    pool,
    predictions: predictions.map(mapPrediction),
    players: players.map(mapPlayer),
    playerStatSnapshots: playerStatSnapshots.map(mapPlayerStatSnapshot),
    profiles: mappedProfiles,
    squadMembers: squadMembers.map(mapSquadMember),
    standings: buildStandings(standings),
    syncRuns: syncRuns.map(mapSyncRun),
    teams: mappedTeams,
    categoryLeaderboards: aggregateCategoryLeaderboards({
      events: mappedEvents,
      matches: mappedMatches,
      playerStats: mappedPlayerStats,
      teams: mappedTeams,
    }),
  };
}
