import { NextResponse } from "next/server";
import {
  buildBonusScoreRows,
  buildMatchScoreRows,
  type BonusWinner,
} from "@/lib/admin/recalculation";
import { isSystemAdminUser } from "@/lib/admin/access";
import { determineResult } from "@/lib/scoring/scoring";
import { matchUsesScorePrediction } from "@/lib/stages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BonusPick,
  BonusPickType,
  Match,
  Prediction,
  ScoringMode,
} from "@/lib/types";

type AdminOverridePayload = {
  matchId?: string;
  overrideType?:
    | "bonus_winner"
    | "event_delete"
    | "event_upsert"
    | "match"
    | "player_stat"
    | "recalculate_all"
    | "recalculate_match";
  payload?: Record<string, unknown>;
  poolId?: string;
  reason?: string;
};

type MatchPlayerStatRow = {
  assists: number | null;
  clean_sheets: number | null;
  goals: number | null;
  player_id: string | null;
  player_name: string | null;
  red_cards: number | null;
  saves: number | null;
  team_id: string | null;
  updated_at: string | null;
  yellow_cards: number | null;
};

type QueryResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

const allowedMatchFields = [
  "away_score",
  "away_team_id",
  "city",
  "elapsed_minutes",
  "home_score",
  "home_team_id",
  "kickoff_at",
  "prediction_lock_at",
  "provider_status_code",
  "stage",
  "status",
  "venue",
  "winner",
] as const;

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function selectAllPaged<T>(
  buildQuery: (from: number, to: number) => QueryResult<T>,
) {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < pageSize) {
      break;
    }
  }

  return rows;
}

function mapPrediction(row: {
  away_score: number;
  home_score: number;
  id: string;
  match_id: string;
  pool_id: string;
  predicted_result: Prediction["predictedResult"];
  updated_at?: string;
  user_id: string;
}): Prediction {
  return {
    awayScore: row.away_score,
    homeScore: row.home_score,
    id: row.id,
    matchId: row.match_id,
    poolId: row.pool_id,
    predictedResult: row.predicted_result,
    updatedAt: row.updated_at ?? new Date().toISOString(),
    userId: row.user_id,
  };
}

function mapMatch(row: {
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
}): Match {
  const numericFixtureId = Number(row.id);

  return {
    apiFootballFixtureId:
      row.api_football_fixture_id ??
      (Number.isFinite(numericFixtureId) ? numericFixtureId : 0),
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

export async function POST(request: Request) {
  const body = (await request.json()) as AdminOverridePayload;

  if (!body.poolId || !body.overrideType || !body.payload) {
    return NextResponse.json({ error: "Invalid admin override payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isSystemAdminUser(user)) {
    return NextResponse.json(
      {
        error:
          "Match, event, and stat overrides affect global tournament data and are restricted to Miguel.",
      },
      { status: 403 },
    );
  }

  const { data: member } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", body.poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  try {
    await applyOverride({
      admin,
      createdBy: user.id,
      matchId: body.matchId,
      overrideType: body.overrideType,
      payload: body.payload,
      poolId: body.poolId,
    });

    const { error: auditError } = await admin.from("admin_overrides").insert({
      created_by: user.id,
      match_id: body.matchId ?? null,
      override_type: body.overrideType,
      payload: body.payload,
      pool_id: body.poolId,
      reason: body.reason ?? "",
    });

    if (auditError) {
      throw new Error(auditError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin override failed" },
      { status: 500 },
    );
  }
}

async function applyOverride({
  admin,
  createdBy,
  matchId,
  overrideType,
  payload,
  poolId,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  createdBy: string;
  matchId?: string;
  overrideType: NonNullable<AdminOverridePayload["overrideType"]>;
  payload: Record<string, unknown>;
  poolId: string;
}) {
  if (overrideType === "match") {
    await applyMatchOverride({ admin, matchId, payload, poolId });
    return;
  }

  if (overrideType === "event_upsert") {
    await applyEventUpsert({ admin, matchId, payload });
    await recalculateTournamentStats(admin);
    return;
  }

  if (overrideType === "event_delete") {
    await applyEventDelete({ admin, matchId, payload });
    await recalculateTournamentStats(admin);
    return;
  }

  if (overrideType === "player_stat") {
    await applyPlayerStatOverride({ admin, matchId, payload });
    await recalculateTournamentStats(admin);
    return;
  }

  if (overrideType === "bonus_winner") {
    await applyBonusWinner({
      admin,
      createdBy,
      payload,
      poolId,
    });
    return;
  }

  if (overrideType === "recalculate_match") {
    await recalculateMatchScores({ admin, matchId, poolId });
    return;
  }

  if (overrideType === "recalculate_all") {
    await recalculateAll({ admin, poolId });
    return;
  }

  throw new Error(`Unsupported override type: ${overrideType}`);
}

async function applyMatchOverride({
  admin,
  matchId,
  payload,
  poolId,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  matchId?: string;
  payload: Record<string, unknown>;
  poolId: string;
}) {
  if (!matchId) {
    throw new Error("Match override requires matchId");
  }

  const update = Object.fromEntries(
    allowedMatchFields
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );

  const homeScore = numberValue(update.home_score);
  const awayScore = numberValue(update.away_score);
  const explicitWinner =
    update.winner === "home" || update.winner === "away" || update.winner === "draw";

  if (!explicitWinner && homeScore !== undefined && awayScore !== undefined) {
    update.winner = determineResult({ awayScore, homeScore });
  }

  const { error } = await admin
    .from("matches")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", matchId);

  if (error) {
    throw new Error(error.message);
  }

  await recalculateMatchScores({ admin, matchId, poolId });
}

async function applyEventUpsert({
  admin,
  matchId,
  payload,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  matchId?: string;
  payload: Record<string, unknown>;
}) {
  if (!matchId) {
    throw new Error("Event override requires matchId");
  }

  const providerEventId =
    stringValue(payload.providerEventId) ?? `manual:${crypto.randomUUID()}`;
  const teamId = stringValue(payload.teamId);
  const eventType = stringValue(payload.eventType);

  if (!teamId || !eventType) {
    throw new Error("Event override requires teamId and eventType");
  }

  const { error } = await admin.from("match_events").upsert(
    {
      assist_name: stringValue(payload.assistName) ?? null,
      detail: stringValue(payload.detail) ?? "",
      elapsed_minutes: numberValue(payload.minute) ?? 0,
      event_type: eventType,
      match_id: matchId,
      player_name: stringValue(payload.playerName) ?? "",
      provider_event_id: providerEventId,
      stoppage_minutes: numberValue(payload.stoppageMinute) ?? null,
      team_id: teamId,
    },
    { onConflict: "match_id,provider_event_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function applyEventDelete({
  admin,
  matchId,
  payload,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  matchId?: string;
  payload: Record<string, unknown>;
}) {
  const eventId = stringValue(payload.eventId);

  if (!matchId || !eventId) {
    throw new Error("Event delete requires matchId and eventId");
  }

  const { error } = await admin
    .from("match_events")
    .delete()
    .eq("match_id", matchId)
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

async function applyPlayerStatOverride({
  admin,
  matchId,
  payload,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  matchId?: string;
  payload: Record<string, unknown>;
}) {
  const teamId = stringValue(payload.teamId);
  const playerName = stringValue(payload.playerName);

  if (!matchId || !teamId || !playerName) {
    throw new Error("Player stat override requires matchId, teamId, and playerName");
  }

  const { error } = await admin.from("match_player_stats").upsert(
    {
      assists: numberValue(payload.assists) ?? 0,
      clean_sheets: numberValue(payload.cleanSheets) ?? 0,
      goals: numberValue(payload.goals) ?? 0,
      match_id: matchId,
      minutes: numberValue(payload.minutes) ?? 0,
      player_id: stringValue(payload.playerId) ?? null,
      player_name: playerName,
      position: stringValue(payload.position) ?? null,
      red_cards: numberValue(payload.redCards) ?? 0,
      saves: numberValue(payload.saves) ?? 0,
      team_id: teamId,
      updated_at: new Date().toISOString(),
      yellow_cards: numberValue(payload.yellowCards) ?? 0,
    },
    { onConflict: "match_id,team_id,player_name" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function applyBonusWinner({
  admin,
  createdBy,
  payload,
  poolId,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  createdBy: string;
  payload: Record<string, unknown>;
  poolId: string;
}) {
  const type = stringValue(payload.type) as BonusPickType | undefined;
  const optionId = stringValue(payload.optionId);
  const slot = numberValue(payload.slot) ?? 1;

  if (!type || !optionId) {
    throw new Error("Bonus winner requires type and optionId");
  }

  const { error } = await admin.from("bonus_winners").upsert(
    {
      decided_by: createdBy,
      option_id: optionId,
      pool_id: poolId,
      slot,
      type,
    },
    { onConflict: "pool_id,type,slot,option_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  await recalculateBonusScores(admin, poolId);
}

async function recalculateMatchScores({
  admin,
  matchId,
  poolId,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  matchId?: string;
  poolId: string;
}) {
  if (!matchId) {
    throw new Error("Recalculation requires matchId");
  }

  const [{ data: pool }, { data: match }, predictions, members] =
    await Promise.all([
      admin
        .from("pools")
        .select("id,scoring_mode,score_prediction_stages")
        .eq("id", poolId)
        .single(),
      admin
        .from("matches")
        .select(
          "id,api_football_fixture_id,home_team_id,away_team_id,stage,group_name,venue,city,kickoff_at,prediction_lock_at,status,provider_status_code,elapsed_minutes,home_score,away_score,winner,last_synced_at",
        )
        .eq("id", matchId)
        .single(),
      selectAllPaged<{
        away_score: number;
        home_score: number;
        id: string;
        match_id: string;
        pool_id: string;
        predicted_result: Prediction["predictedResult"];
        updated_at?: string;
        user_id: string;
      }>((from, to) =>
        admin
          .from("predictions")
          .select("id,pool_id,match_id,user_id,predicted_result,home_score,away_score,updated_at")
          .eq("pool_id", poolId)
          .eq("match_id", matchId)
          .order("user_id", { ascending: true })
          .range(from, to),
      ),
      selectAllPaged<{ user_id: string }>((from, to) =>
        admin
          .from("pool_members")
          .select("user_id")
          .eq("pool_id", poolId)
          .order("user_id", { ascending: true })
          .range(from, to),
      ),
    ]);

  if (!pool || !match) {
    throw new Error("Missing pool or match for recalculation");
  }

  const rows = buildMatchScoreRows({
    activePlayerCount: members.length,
    match: mapMatch(match),
    poolId,
    predictions: predictions.map(mapPrediction),
    scoringMode: pool.scoring_mode as ScoringMode,
    scorePrediction: matchUsesScorePrediction(
      (pool as { score_prediction_stages?: string[] }).score_prediction_stages,
      match.stage,
    ),
  });

  if (rows.length > 0) {
    const { error } = await admin
      .from("score_snapshots")
      .upsert(rows, { onConflict: "pool_id,match_id,user_id,scoring_mode" });

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function recalculateBonusScores(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  poolId: string,
) {
  const [{ data: winners }, picks] = await Promise.all([
    admin.from("bonus_winners").select("type,slot,option_id").eq("pool_id", poolId),
    selectAllPaged<{
      id: string;
      option_id: string;
      pool_id: string;
      slot: number | null;
      type: BonusPickType;
      updated_at: string | null;
      user_id: string;
    }>((from, to) =>
      admin
        .from("bonus_picks")
        .select("id,pool_id,user_id,type,slot,option_id,updated_at")
        .eq("pool_id", poolId)
        .order("user_id", { ascending: true })
        .order("type", { ascending: true })
        .range(from, to),
    ),
  ]);

  const rows = buildBonusScoreRows({
    picks: picks.map((pick) => ({
      id: pick.id,
      optionId: pick.option_id,
      poolId: pick.pool_id,
      slot: pick.slot ?? 1,
      type: pick.type as BonusPick["type"],
      updatedAt: pick.updated_at ?? new Date().toISOString(),
      userId: pick.user_id,
    })),
    poolId,
    winners: (winners ?? []).map((winner) => ({
      optionId: winner.option_id,
      slot: winner.slot ?? 1,
      type: winner.type as BonusWinner["type"],
    })),
  });

  if (rows.length > 0) {
    const { error } = await admin
      .from("bonus_score_snapshots")
      .upsert(rows, { onConflict: "pool_id,user_id,type,slot" });

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function recalculateTournamentStats(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const stats = await fetchAllMatchPlayerStats(admin);
  const grouped = new Map<string, {
    assists: number;
    clean_sheets: number;
    goals: number;
    player_id: string | null;
    player_name: string;
    red_cards: number;
    saves: number;
    team_id: string;
    updated_at: string;
    yellow_cards: number;
  }>();

  (stats ?? []).forEach((stat) => {
    if (!stat.team_id || !stat.player_name) {
      return;
    }

    const key = stat.player_id
      ? `id:${stat.player_id}`
      : `name:${stat.team_id}:${stat.player_name}`;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        assists: stat.assists ?? 0,
        clean_sheets: stat.clean_sheets ?? 0,
        goals: stat.goals ?? 0,
        player_id: stat.player_id ?? null,
        player_name: stat.player_name,
        red_cards: stat.red_cards ?? 0,
        saves: stat.saves ?? 0,
        team_id: stat.team_id,
        updated_at: stat.updated_at ?? new Date().toISOString(),
        yellow_cards: stat.yellow_cards ?? 0,
      });
      return;
    }

    current.assists += stat.assists ?? 0;
    current.clean_sheets += stat.clean_sheets ?? 0;
    current.goals += stat.goals ?? 0;
    current.red_cards += stat.red_cards ?? 0;
    current.saves += stat.saves ?? 0;
    current.yellow_cards += stat.yellow_cards ?? 0;
    if ((stat.updated_at ?? "") >= current.updated_at) {
      current.player_name = stat.player_name;
      current.updated_at = stat.updated_at ?? current.updated_at;
    }
  });

  const rows = [...grouped.values()];

  const { error: deleteError } = await admin
    .from("tournament_player_stat_snapshots")
    .delete()
    .neq("team_id", "__never__");

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from("tournament_player_stat_snapshots")
      .upsert(rows, { onConflict: "team_id,player_id" });

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function fetchAllMatchPlayerStats(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  return selectAllPaged<MatchPlayerStatRow>((from, to) =>
    admin
      .from("match_player_stats")
      .select("player_id,player_name,team_id,goals,assists,yellow_cards,red_cards,saves,clean_sheets,updated_at")
      .order("match_id", { ascending: true })
      .order("team_id", { ascending: true })
      .range(from, to),
  );
}

async function recalculateAll({
  admin,
  poolId,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  poolId: string;
}) {
  const { data: matches } = await admin
    .from("matches")
    .select("id")
    .eq("status", "finished");

  for (const match of matches ?? []) {
    await recalculateMatchScores({ admin, matchId: match.id, poolId });
  }

  await recalculateBonusScores(admin, poolId);
  await recalculateTournamentStats(admin);
}
