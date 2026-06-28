import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const apiFootballBaseUrl = "https://v3.football.api-sports.io";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SyncResult = {
  status?: "ok" | "warning" | "error";
  requestsUsed: number;
  message: string;
};

type SyncMode =
  | "live"
  | "lineups"
  | "post-match"
  | "reference"
  | "squads"
  | "stats"
  | "form";

type ApiFootballLineupPlayer = {
  player?: {
    grid?: string | null;
    id?: number;
    name?: string;
    number?: number;
    pos?: string;
  };
};

type ApiFootballLineup = {
  coach?: { name?: string };
  formation?: string | null;
  startXI?: ApiFootballLineupPlayer[];
  substitutes?: ApiFootballLineupPlayer[];
  team?: { id?: number };
};

// Stage category for the per-stage score-prediction setting (mirrors
// src/lib/stages.ts). 1X2 stages never award the exact-score bonus.
function stageCategory(stage: string): string {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("group")) return "group";
  if (s.includes("round of 32") || s.includes("1/16")) return "r32";
  if (s.includes("round of 16") || s.includes("1/8")) return "r16";
  if (s.includes("quarter") || s.includes("1/4")) return "qf";
  if (s.includes("semi") || s.includes("1/2")) return "sf";
  if (s.includes("final") || s.includes("3rd place") || s.includes("third place")) {
    return "final";
  }
  return "group";
}

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: {
      elapsed: number | null;
      short: string;
    };
    venue?: {
      city?: string;
      name?: string;
    };
  };
  goals: {
    away: number | null;
    home: number | null;
  };
  league: {
    id: number;
    round?: string;
  };
  teams: {
    away: {
      id: number;
      name: string;
      logo?: string;
    };
    home: {
      id: number;
      name: string;
      logo?: string;
    };
  };
};

type ApiFootballEvent = {
  assist?: {
    id?: number | null;
    name?: string | null;
  };
  comments?: string | null;
  detail?: string;
  player?: {
    id?: number | null;
    name?: string | null;
  };
  team?: {
    id?: number;
    name?: string;
  };
  time?: {
    elapsed?: number | null;
    extra?: number | null;
  };
  type?: string;
};

type ApiFootballFixturePlayerStats = {
  players?: Array<{
    player?: {
      id?: number | null;
      name?: string | null;
      photo?: string | null;
    };
    statistics?: Array<{
      cards?: {
        red?: number | null;
        yellow?: number | null;
      };
      games?: {
        minutes?: number | null;
        position?: string | null;
        rating?: string | null;
      };
      goals?: {
        assists?: number | null;
        total?: number | null;
      };
      goalkeeper?: {
        saves?: number | null;
      };
    }>;
  }>;
  team?: {
    id?: number | null;
    name?: string;
  };
};

type ApiFootballStandingTeam = {
  all?: {
    draw?: number | null;
    goals?: {
      against?: number | null;
      for?: number | null;
    };
    lose?: number | null;
    played?: number | null;
    win?: number | null;
  };
  description?: string | null;
  group?: string;
  points?: number | null;
  rank?: number | null;
  team?: {
    id?: number | null;
    logo?: string;
    name?: string;
  };
};

type ApiFootballSquadResponse = {
  players?: Array<{
    age?: number | null;
    id?: number | null;
    name?: string | null;
    number?: number | null;
    photo?: string | null;
    position?: string | null;
  }>;
  team?: {
    id?: number | null;
    name?: string;
  };
};

type PoolRow = {
  id: string;
  scoring_mode: "traditional" | "pot";
  score_prediction_stages: string[] | null;
};

type PoolMemberRow = {
  pool_id: string;
  user_id: string;
};

type PredictionRow = {
  away_score: number;
  home_score: number;
  id: string;
  match_id: string;
  pool_id: string;
  predicted_result: "home" | "draw" | "away";
  user_id: string;
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

const syncLockKey = 2026001;

Deno.serve(async (request) => {
  const startedAt = new Date().toISOString();
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = request.headers.get("Authorization") ?? "";
  const mode = syncModeFromRequest(request);

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Missing Supabase Edge Function environment variables" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: syncRun } = await supabase
    .from("sync_runs")
    .insert({
      message: "World Cup sync started.",
      source: `api-football:${mode}`,
      started_at: startedAt,
      status: "ok",
    })
    .select("id")
    .single();

  try {
    const result = await runSyncMode(supabase, mode);

    if (syncRun?.id) {
      await supabase
        .from("sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          message: result.message,
          requests_used: result.requestsUsed,
          status: result.status ?? "ok",
        })
        .eq("id", syncRun.id);
    }

    return Response.json(result);
  } catch (error) {
    if (syncRun?.id) {
      await supabase
        .from("sync_runs")
        .update({
          error: { message: error instanceof Error ? error.message : String(error) },
          finished_at: new Date().toISOString(),
          message: "World Cup sync failed.",
          status: "error",
        })
        .eq("id", syncRun.id);
    }

    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});

function syncModeFromRequest(request: Request): SyncMode {
  const mode = new URL(request.url).searchParams.get("mode");

  if (
    mode === "live" ||
    mode === "lineups" ||
    mode === "post-match" ||
    mode === "reference" ||
    mode === "squads" ||
    mode === "stats" ||
    mode === "form"
  ) {
    return mode;
  }

  return "live";
}

async function runSyncMode(
  supabase: ReturnType<typeof createClient>,
  mode: SyncMode,
): Promise<SyncResult> {
  if (mode === "reference") {
    return runReferenceSync(supabase);
  }

  if (mode === "squads") {
    return runSquadSync(supabase);
  }

  if (mode === "post-match") {
    return runPostMatchSync(supabase);
  }

  if (mode === "lineups") {
    return runLineupSync(supabase);
  }

  if (mode === "stats") {
    await recalculateTournamentPlayerStats(supabase);
    return {
      message: "Tournament player stat snapshots recalculated.",
      requestsUsed: 0,
    };
  }

  if (mode === "form") {
    return runFormSync(supabase);
  }

  return runLiveLoop(supabase);
}

async function runFormSync(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  const { data: teams } = await supabase.from("teams").select("id");
  const finished = new Set(["FT", "AET", "PEN"]);
  let requestsUsed = 0;

  for (const team of teams ?? []) {
    const numericId = Number(team.id);
    if (!Number.isFinite(numericId)) {
      continue;
    }

    const response = await fetchApiFootball("/fixtures", {
      team: numericId,
      last: 5,
    });
    requestsUsed += 1;

    const entries = (response.response ?? [])
      .filter(
        (item: ApiFootballFixture) =>
          finished.has(item.fixture?.status?.short) &&
          item.goals?.home !== null &&
          item.goals?.away !== null,
      )
      .map((item: ApiFootballFixture) => {
        const isHome = String(item.teams?.home?.id) === String(team.id);
        const gf = (isHome ? item.goals.home : item.goals.away) ?? 0;
        const ga = (isHome ? item.goals.away : item.goals.home) ?? 0;
        const opponent = isHome ? item.teams?.away?.name : item.teams?.home?.name;
        return {
          date: item.fixture.date,
          competition:
            (item.league as { name?: string }).name ?? "",
          wc: item.league?.id === 1,
          opponent: opponent ?? "TBD",
          gf,
          ga,
          result: gf > ga ? "W" : gf < ga ? "L" : "D",
        };
      })
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

    await supabase
      .from("teams")
      .update({ recent_form: entries })
      .eq("id", team.id);
  }

  return {
    message: `Recent form synced for ${teams?.length ?? 0} teams.`,
    requestsUsed,
  };
}

async function runLiveLoop(supabase: ReturnType<typeof createClient>): Promise<SyncResult> {
  // Skip the API entirely when nothing is in play. Matches already live or at
  // half-time stay in scope no matter how long ago they kicked off — they must
  // be confirmed finished before we stop watching (a stuck "live" row would
  // otherwise freeze scores forever). The 3.5h kickoff cutoff only bounds
  // which *scheduled* matches can open the window.
  const windowStart = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const { data: inWindow } = await supabase
    .from("matches")
    .select("id")
    .or(
      `status.in.(live,halftime),and(status.eq.scheduled,kickoff_at.gte.${windowStart},kickoff_at.lte.${windowEnd})`,
    )
    .limit(1);

  if (!inWindow || inWindow.length === 0) {
    return {
      message: "No matches in window; skipped live poll.",
      requestsUsed: 0,
    };
  }

  const { data: lockAcquired, error: lockError } = await supabase.rpc(
    "try_world_cup_sync_lock",
    { lock_key: syncLockKey },
  );

  if (lockError) {
    throw new Error(`Could not acquire sync lock: ${lockError.message}`);
  }

  if (!lockAcquired) {
    return {
      message: "Another World Cup sync is already running.",
      requestsUsed: 0,
      status: "warning",
    };
  }

  let requestsUsed = 0;
  const syncedPlayerStatsFixtureIds = new Set<number>();

  try {
    for (let tick = 0; tick < 4; tick += 1) {
      const liveFixtures = await fetchApiFootball("/fixtures", { live: "all" });
      requestsUsed += 1;

      const syncTargets = await upsertLiveFixtures(supabase, liveFixtures.response ?? []);

      // A fixture drops out of live:all the moment it goes FT, so the final
      // whistle is easy to miss entirely. Any match our DB still has as
      // live/halftime but the live feed no longer mentions gets re-fetched by
      // id; the upsert then records its real status (FT/AET/PEN → finished)
      // and the finished paths below pick it up like any other final.
      const liveFeedFixtureIds = new Set(
        (liveFixtures.response ?? [])
          .filter((item) => item?.league?.id === 1)
          .map((item) => item.fixture.id),
      );
      const { data: dbLiveMatches } = await supabase
        .from("matches")
        .select("api_football_fixture_id")
        .in("status", ["live", "halftime"])
        .not("api_football_fixture_id", "is", null);
      const missingFixtureIds = (dbLiveMatches ?? [])
        .map((row) => Number(row.api_football_fixture_id))
        .filter((id) => Number.isFinite(id) && !liveFeedFixtureIds.has(id));

      for (const fixtureId of missingFixtureIds) {
        const byId = await fetchApiFootball("/fixtures", { id: fixtureId });
        requestsUsed += 1;
        const rescued = await upsertLiveFixtures(supabase, byId.response ?? []);
        syncTargets.fixtureIds.push(...rescued.fixtureIds);
        syncTargets.finishedFixtureIds.push(...rescued.finishedFixtureIds);
        syncTargets.finishedMatchIds.push(...rescued.finishedMatchIds);
      }

      for (const fixtureId of syncTargets.fixtureIds) {
        const events = await fetchApiFootball("/fixtures/events", { fixture: fixtureId });
        requestsUsed += 1;
        await upsertFixtureEvents(supabase, fixtureId, events.response ?? []);
      }

      for (const fixtureId of syncTargets.finishedFixtureIds) {
        if (syncedPlayerStatsFixtureIds.has(fixtureId)) {
          continue;
        }

        const playerStats = await fetchApiFootball("/fixtures/players", {
          fixture: fixtureId,
        });
        requestsUsed += 1;
        syncedPlayerStatsFixtureIds.add(fixtureId);
        await upsertFixturePlayerStats(
          supabase,
          fixtureId,
          playerStats.response ?? [],
        );
      }

      await recalculateFinishedFixtures(supabase, syncTargets.finishedMatchIds);

      // A final just landed: refresh the group tables from our own results so
      // Groups updates within the same minute (the provider's standings lag).
      if (syncTargets.finishedMatchIds.length > 0) {
        await recalculateGroupStandings(supabase);
      }

      if (tick < 3) {
        await sleep(15_000);
      }
    }

    return {
      message: "Live fixtures, events, and score snapshots synced.",
      requestsUsed,
    };
  } finally {
    await supabase.rpc("release_world_cup_sync_lock", { lock_key: syncLockKey });
  }
}

// Fetch starting XIs for matches kicking off within the next hour (or just
// kicked off) that we don't have yet. Runs every minute via cron; once a
// match's lineup is stored we skip it, so it self-throttles to ~0 API calls
// outside the pre-match window.
async function runLineupSync(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  const now = Date.now();
  const windowStart = new Date(now - 30 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 60 * 60 * 1000).toISOString();

  const { data: candidates } = await supabase
    .from("matches")
    .select("id,api_football_fixture_id,kickoff_at")
    .in("status", ["scheduled", "live", "halftime"])
    .gte("kickoff_at", windowStart)
    .lte("kickoff_at", windowEnd);

  if (!candidates || candidates.length === 0) {
    return { message: "No matches in lineup window.", requestsUsed: 0 };
  }

  const { data: existing } = await supabase
    .from("match_lineups")
    .select("match_id")
    .in("match_id", candidates.map((match) => match.id));
  const haveLineup = new Set((existing ?? []).map((row) => row.match_id));
  const todo = candidates.filter(
    (match) => !haveLineup.has(match.id) && match.api_football_fixture_id,
  );

  let requestsUsed = 0;
  let fetched = 0;

  for (const match of todo) {
    const response = await fetchApiFootball("/fixtures/lineups", {
      fixture: match.api_football_fixture_id,
    });
    requestsUsed += 1;
    const lineups = (response.response ?? []) as ApiFootballLineup[];

    // Not published yet — try again on the next cron tick.
    if (lineups.length === 0) {
      continue;
    }

    const toRow = (player: ApiFootballLineupPlayer, starter: boolean) => ({
      grid: starter ? player.player?.grid ?? null : null,
      id: player.player?.id ? String(player.player.id) : null,
      name: player.player?.name ?? "",
      number: player.player?.number ?? null,
      pos: player.player?.pos ?? null,
      starter,
    });

    const rows = lineups
      .filter((lineup) => lineup.team?.id)
      .map((lineup) => ({
        coach: lineup.coach?.name ?? null,
        formation: lineup.formation ?? null,
        match_id: match.id,
        players: [
          ...(lineup.startXI ?? []).map((player) => toRow(player, true)),
          ...(lineup.substitutes ?? []).map((player) => toRow(player, false)),
        ],
        team_id: String(lineup.team!.id),
      }));

    if (rows.length > 0) {
      await supabase
        .from("match_lineups")
        .upsert(rows, { onConflict: "match_id,team_id" });
      fetched += 1;
    }
  }

  return {
    message: `Lineups: ${fetched} fetched, ${todo.length - fetched} still pending.`,
    requestsUsed,
  };
}

async function runReferenceSync(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  let requestsUsed = 0;

  // Snapshot which matches were already final, so we can tell which ones the
  // full-schedule upsert below flips to finished (e.g. a final the live loop
  // missed entirely during an outage) — those still need events/player stats.
  const { data: finishedBefore } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "finished");
  const previouslyFinished = new Set((finishedBefore ?? []).map((row) => row.id));

  const fixtures = await fetchApiFootball("/fixtures", {
    league: 1,
    season: 2026,
  });
  requestsUsed += 1;
  const syncTargets = await upsertLiveFixtures(supabase, fixtures.response ?? []);

  const standings = await fetchApiFootball("/standings", {
    league: 1,
    season: 2026,
  });
  requestsUsed += 1;
  await upsertStandings(supabase, standings.response ?? []);

  // Run after the provider upsert: our own match results win the counting
  // columns (the provider's standings can lag finals by hours), while the
  // provider keeps ownership of the qualification flag set above.
  await recalculateGroupStandings(supabase);

  // Catch-up for finals the live loop missed (outage, provider lag): the
  // full-schedule upsert above is what flipped them to finished, so fetch
  // their events and player stats here — they'd otherwise wait for the
  // 6-hourly post-match cron.
  const newlyFinished = syncTargets.finishedMatchIds
    .map((matchId, index) => ({
      fixtureId: syncTargets.finishedFixtureIds[index],
      matchId,
    }))
    .filter((pair) => pair.fixtureId && !previouslyFinished.has(pair.matchId));

  for (const { fixtureId } of newlyFinished) {
    const events = await fetchApiFootball("/fixtures/events", { fixture: fixtureId });
    requestsUsed += 1;
    await upsertFixtureEvents(supabase, fixtureId, events.response ?? []);

    const playerStats = await fetchApiFootball("/fixtures/players", {
      fixture: fixtureId,
    });
    requestsUsed += 1;
    await upsertFixturePlayerStats(supabase, fixtureId, playerStats.response ?? []);
  }

  // Settle points too. Idempotent for already-scored matches.
  if (syncTargets.finishedMatchIds.length > 0) {
    await recalculateFinishedFixtures(supabase, syncTargets.finishedMatchIds);
  }

  return {
    message: `Reference schedule synced: ${syncTargets.fixtureIds.length} fixtures.`,
    requestsUsed,
  };
}

async function runSquadSync(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  const { data: teams } = await supabase.from("teams").select("id,name");
  let requestsUsed = 0;
  let playerCount = 0;

  for (const team of teams ?? []) {
    const numericTeamId = Number(team.id);

    if (!Number.isFinite(numericTeamId)) {
      continue;
    }

    const squads = await fetchApiFootball("/players/squads", {
      team: numericTeamId,
    });
    requestsUsed += 1;
    playerCount += await upsertSquads(supabase, squads.response ?? []);
  }

  return {
    message: `Squads synced for ${teams?.length ?? 0} teams, ${playerCount} players.`,
    requestsUsed,
  };
}

async function runPostMatchSync(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("id,api_football_fixture_id")
    .eq("status", "finished");
  let requestsUsed = 0;
  const matchIds: string[] = [];

  for (const match of finishedMatches ?? []) {
    const fixtureId = match.api_football_fixture_id;

    if (!fixtureId) {
      continue;
    }

    const events = await fetchApiFootball("/fixtures/events", { fixture: fixtureId });
    requestsUsed += 1;
    await upsertFixtureEvents(supabase, fixtureId, events.response ?? []);

    const playerStats = await fetchApiFootball("/fixtures/players", {
      fixture: fixtureId,
    });
    requestsUsed += 1;
    await upsertFixturePlayerStats(supabase, fixtureId, playerStats.response ?? []);
    matchIds.push(match.id);
  }

  await recalculateFinishedFixtures(supabase, matchIds);
  await recalculateTournamentPlayerStats(supabase);

  return {
    message: `Post-match events and player stats synced for ${matchIds.length} fixtures.`,
    requestsUsed,
  };
}

async function fetchApiFootball(
  path: string,
  params: Record<string, string | number>,
) {
  const apiKey = Deno.env.get("API_FOOTBALL_KEY");

  if (!apiKey) {
    throw new Error("Missing API_FOOTBALL_KEY");
  }

  const url = new URL(`${apiFootballBaseUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  return response.json();
}

async function upsertLiveFixtures(
  supabase: ReturnType<typeof createClient>,
  fixtures: ApiFootballFixture[],
): Promise<{ finishedFixtureIds: number[]; finishedMatchIds: string[]; fixtureIds: number[] }> {
  const worldCupFixtures = fixtures.filter((item) => item?.league?.id === 1);

  if (worldCupFixtures.length === 0) {
    return { finishedFixtureIds: [], finishedMatchIds: [], fixtureIds: [] };
  }

  const normalizedFixtureTeams = worldCupFixtures.flatMap((item) => [
    normalizeFixtureTeam(item, "home"),
    normalizeFixtureTeam(item, "away"),
  ]);
  const teamRows = uniqueBy(
    normalizedFixtureTeams.map((team) => {
      const iso2 = iso2FromTeamName(team.name);
      return {
        flag_url: team.logo,
        id: team.id,
        name: team.name,
        short_name: shortNameFromTeamName(team.name),
        // Omit iso2 when unknown so the upsert doesn't overwrite good DB data with null.
        ...(iso2 !== null && { iso2 }),
      };
    }),
    (row) => row.id,
  );

  await supabase.from("teams").upsert(teamRows, { onConflict: "id" });
  await upsertCountryCardBonusOptions(supabase, teamRows);

  const rows = worldCupFixtures.map((item) => {
    const kickoffAt = item.fixture.date;
    const homeTeam = normalizeFixtureTeam(item, "home");
    const awayTeam = normalizeFixtureTeam(item, "away");
    const groupName = groupNameFromRound(item.league.round);
    const predictionLockAt = new Date(
      new Date(kickoffAt).getTime() - 15 * 60 * 1000,
    ).toISOString();

    return {
      api_football_fixture_id: item.fixture.id,
      away_score: item.goals.away,
      away_team_id: awayTeam.id,
      city: item.fixture.venue?.city,
      elapsed_minutes: item.fixture.status.elapsed,
      home_score: item.goals.home,
      home_team_id: homeTeam.id,
      id: String(item.fixture.id),
      kickoff_at: kickoffAt,
      last_synced_at: new Date().toISOString(),
      prediction_lock_at: predictionLockAt,
      provider_status_code: item.fixture.status.short,
      stage: item.league.round ?? "World Cup",
      status: mapFixtureStatus(item.fixture.status.short),
      updated_at: new Date().toISOString(),
      venue: item.fixture.venue?.name,
      winner: determineResultFromNullableScores(item.goals.home, item.goals.away),
      ...(groupName !== null && { group_name: groupName }),
    };
  });

  await supabase
    .from("matches")
    .upsert(rows, { onConflict: "api_football_fixture_id" });

  return {
    finishedFixtureIds: rows
      .filter((row) => row.status === "finished")
      .map((row) => row.api_football_fixture_id),
    finishedMatchIds: rows
      .filter((row) => row.status === "finished")
      .map((row) => row.id),
    fixtureIds: worldCupFixtures.map((item) => item.fixture.id),
  };
}

async function upsertCountryCardBonusOptions(
  supabase: ReturnType<typeof createClient>,
  teams: Array<{ id: string; name: string }>,
) {
  if (teams.length === 0) {
    return;
  }

  const rows = teams.map((team) => ({
    active: true,
    id: `bonus-cards-${team.id}`,
    label: team.name,
    team_id: team.id,
    type: "most_cards_country",
  }));

  await supabase
    .from("bonus_pick_options")
    .upsert(rows, { onConflict: "id" });
}

// Group tables computed from our own finished match results (zero API calls).
// The provider's /standings endpoint lags finals by hours — and our matches
// table is fresh within seconds of FT — so this is the timely source for the
// counting columns. The provider's standings still run in reference mode and
// own the qualification flag; this upsert deliberately omits that column so
// it never overwrites provider data.
async function recalculateGroupStandings(
  supabase: ReturnType<typeof createClient>,
) {
  // The provider stopped putting the group letter in the fixture round
  // ("Group Stage - 1"), so matches can't tell us their group. Teams can:
  // teams.group_name comes from the provider's standings payload. A match
  // belongs to a group when both its teams agree on one.
  const [{ data: teams }, { data: allMatches }] = await Promise.all([
    supabase
      .from("teams")
      .select("id,group_name")
      .not("group_name", "is", null),
    supabase
      .from("matches")
      .select("id,home_team_id,away_team_id,home_score,away_score,status,group_name,stage"),
  ]);

  const teamGroup = new Map(
    (teams ?? []).map((team) => [String(team.id), team.group_name as string]),
  );
  const groupOf = (match: {
    group_name: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
  }) => {
    const fromMatch = normalizeGroupName(match.group_name);
    if (fromMatch) {
      return fromMatch;
    }
    const home = teamGroup.get(String(match.home_team_id));
    const away = teamGroup.get(String(match.away_team_id));
    return home && home === away ? home : null;
  };

  const groupMatches = (allMatches ?? [])
    .filter((match) => /group/i.test(match.stage ?? ""))
    .map((match) => ({ ...match, resolved_group: groupOf(match) }))
    .filter(
      (match): match is typeof match & { resolved_group: string } =>
        match.resolved_group !== null,
    );

  if (groupMatches.length === 0) {
    return;
  }

  // Backfill the resolved group onto matches that lost it, so match cards can
  // show "Group F" again instead of the raw round label.
  const needsBackfill = groupMatches.filter(
    (match) => normalizeGroupName(match.group_name) !== match.resolved_group,
  );
  for (const match of needsBackfill) {
    await supabase
      .from("matches")
      .update({ group_name: match.resolved_group })
      .eq("id", match.id);
  }

  type Tally = {
    drawn: number;
    goals_against: number;
    goals_for: number;
    group_name: string;
    lost: number;
    played: number;
    points: number;
    won: number;
  };
  const tallies = new Map<string, Tally>();
  const ensure = (teamId: string, groupName: string) => {
    let tally = tallies.get(teamId);
    if (!tally) {
      tally = {
        drawn: 0,
        goals_against: 0,
        goals_for: 0,
        group_name: groupName,
        lost: 0,
        played: 0,
        points: 0,
        won: 0,
      };
      tallies.set(teamId, tally);
    }
    return tally;
  };

  for (const match of groupMatches) {
    const groupName = match.resolved_group;
    // Every group team gets a row, even before it has played.
    const home = ensure(String(match.home_team_id), groupName);
    const away = ensure(String(match.away_team_id), groupName);

    if (
      match.status !== "finished" ||
      match.home_score === null ||
      match.away_score === null
    ) {
      continue;
    }

    home.played += 1;
    away.played += 1;
    home.goals_for += match.home_score;
    home.goals_against += match.away_score;
    away.goals_for += match.away_score;
    away.goals_against += match.home_score;

    if (match.home_score > match.away_score) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.home_score < match.away_score) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const { data: pools } = await supabase.from("pools").select("id");
  const updatedAt = new Date().toISOString();
  const rows = (pools ?? []).flatMap((pool) =>
    [...tallies.entries()].map(([teamId, tally]) => ({
      ...tally,
      pool_id: pool.id,
      team_id: teamId,
      updated_at: updatedAt,
    })),
  );

  if (rows.length > 0) {
    await supabase.from("standings").upsert(rows, { onConflict: "pool_id,team_id" });
  }
}

async function upsertStandings(
  supabase: ReturnType<typeof createClient>,
  standingsResponse: Array<{
    league?: {
      standings?: ApiFootballStandingTeam[][];
    };
  }>,
) {
  const groups = standingsResponse.flatMap((item) => item.league?.standings ?? []);
  const standings = groups.flat();

  if (standings.length === 0) {
    return;
  }

  const { data: existingTeams } = await supabase
    .from("teams")
    .select("id,group_name");
  const existingGroupByTeam = new Map(
    (existingTeams ?? []).map((team) => [String(team.id), team.group_name as string | null]),
  );

  const teamRows = standings
    .filter((standing) => standing.team?.id && standing.team.name)
    .map((standing) => {
      const teamName = standing.team?.name ?? "TBD";
      const iso2 = iso2FromTeamName(teamName);
      const providerGroup = normalizeGroupName(standing.group);
      return {
        flag_url: standing.team?.logo,
        id: String(standing.team?.id),
        name: teamName,
        short_name: shortNameFromTeamName(teamName),
        // Omit iso2 when unknown so the upsert doesn't overwrite good DB data with null.
        ...(iso2 !== null && { iso2 }),
        ...(providerGroup !== null && { group_name: providerGroup }),
      };
    });

  if (teamRows.length > 0) {
    await supabase.from("teams").upsert(teamRows, { onConflict: "id" });
    await upsertCountryCardBonusOptions(supabase, teamRows);
  }

  const { data: pools } = await supabase.from("pools").select("id");
  const rows = (pools ?? []).flatMap((pool) =>
    standings
      .filter((standing) => standing.team?.id)
      .map((standing) => {
        const teamId = String(standing.team?.id);
        const groupName =
          normalizeGroupName(standing.group) ??
          existingGroupByTeam.get(teamId) ??
          "Ungrouped";

        return {
          drawn: standing.all?.draw ?? 0,
          goals_against: standing.all?.goals?.against ?? 0,
          goals_for: standing.all?.goals?.for ?? 0,
          group_name: groupName,
          lost: standing.all?.lose ?? 0,
          played: standing.all?.played ?? 0,
          points: standing.points ?? 0,
          pool_id: pool.id,
          qualification: mapQualification(standing.description),
          team_id: teamId,
          updated_at: new Date().toISOString(),
          won: standing.all?.win ?? 0,
        };
      }),
  );

  if (rows.length > 0) {
    await supabase.from("standings").upsert(rows, { onConflict: "pool_id,team_id" });
  }
}

async function upsertSquads(
  supabase: ReturnType<typeof createClient>,
  squads: ApiFootballSquadResponse[],
) {
  const playerRows = squads.flatMap((squad) =>
    (squad.players ?? [])
      .flatMap((player) => {
        if (!player.id || !player.name) {
          return [];
        }

        return [
          {
            id: String(player.id),
            name: player.name,
            photo_url: player.photo ?? null,
            position: player.position ?? null,
            updated_at: new Date().toISOString(),
          },
        ];
      }),
  );
  const memberRows = squads.flatMap((squad) => {
    const teamId = squad.team?.id ? String(squad.team.id) : null;

    if (!teamId) {
      return [];
    }

    return (squad.players ?? []).flatMap((player) => {
      if (!player.id || !player.name) {
        return [];
      }

      return [{
        active: true,
        player_id: String(player.id),
        position: player.position ?? null,
        shirt_number: player.number ?? null,
        team_id: teamId,
        updated_at: new Date().toISOString(),
      }];
    });
  });
  const optionRows = squads.flatMap((squad) => {
    const teamId = squad.team?.id ? String(squad.team.id) : null;
    const teamName = squad.team?.name ?? "";
    const teamShortName = shortNameFromTeamName(teamName);

    if (!teamId) {
      return [];
    }

    return (squad.players ?? []).flatMap((player) => {
      if (!player.id || !player.name) {
        return [];
      }

      return [
        {
          active: true,
          id: `bonus-top-scorer-${player.id}`,
          label: `${player.name} (${teamShortName})`,
          player_id: String(player.id),
          player_name: player.name,
          team_id: teamId,
          type: "top_scorer",
        },
        {
          active: true,
          id: `bonus-most-assists-${player.id}`,
          label: `${player.name} (${teamShortName})`,
          player_id: String(player.id),
          player_name: player.name,
          team_id: teamId,
          type: "most_assists",
        },
      ];
    });
  });

  if (playerRows.length > 0) {
    await supabase.from("players").upsert(playerRows, { onConflict: "id" });
  }

  if (memberRows.length > 0) {
    await supabase
      .from("team_squad_members")
      .upsert(memberRows, { onConflict: "team_id,player_id" });
  }

  if (optionRows.length > 0) {
    await supabase
      .from("bonus_pick_options")
      .upsert(optionRows, { onConflict: "id" });
  }

  return playerRows.length;
}

async function upsertFixtureEvents(
  supabase: ReturnType<typeof createClient>,
  fixtureId: number,
  events: ApiFootballEvent[],
) {
  if (events.length === 0) {
    return;
  }

  // Identify each event by fields that DON'T change between syncs: time, team,
  // the provider's raw type, and the numeric player id. The display name gets
  // enriched ("" → "J. Quinones" → "Julián Quiñones"), detail can change, our
  // mapped type can change, and array position shifts as the live list grows —
  // including any of those bred a fresh row every sync (the duplicate bug).
  // A per-bucket occurrence counter disambiguates the rare identical repeat.
  const bucketCounts = new Map<string, number>();
  const rows = events
    .filter((event) => event.type)
    .map((event) => {
      const elapsed = event.time?.elapsed ?? 0;
      const extra = event.time?.extra ?? null;
      const detail = event.detail ?? event.comments ?? "";
      const eventType = mapEventType(event.type ?? "", detail);

      const bucketKey = [
        fixtureId,
        elapsed,
        extra ?? 0,
        event.team?.id ?? 0,
        (event.type ?? "").toLowerCase(),
        event.player?.id ?? 0,
      ].join(":");
      const occurrence = bucketCounts.get(bucketKey) ?? 0;
      bucketCounts.set(bucketKey, occurrence + 1);

      return {
        assist_id: event.assist?.id ? String(event.assist.id) : null,
        assist_name: event.assist?.name,
        detail,
        elapsed_minutes: elapsed,
        event_type: eventType,
        match_id: String(fixtureId),
        player_id: event.player?.id ? String(event.player.id) : null,
        player_name: event.player?.name ?? "",
        provider_event_id: `${bucketKey}:${occurrence}`,
        stoppage_minutes: extra,
        team_id: event.team?.id ? String(event.team.id) : null,
      };
    });

  if (rows.length === 0) {
    return;
  }

  await supabase
    .from("match_events")
    .upsert(rows, { onConflict: "match_id,provider_event_id" });

  // Self-heal: drop any rows for this fixture that aren't in the provider's
  // current set — clears duplicates left by older id schemes (and any event the
  // provider later retracts). Upsert ran first, so live views never see a gap.
  const currentIds = rows.map((row) => row.provider_event_id);
  await supabase
    .from("match_events")
    .delete()
    .eq("match_id", String(fixtureId))
    .not(
      "provider_event_id",
      "in",
      `(${currentIds.map((id) => `"${id}"`).join(",")})`,
    );
}

async function upsertFixturePlayerStats(
  supabase: ReturnType<typeof createClient>,
  fixtureId: number,
  teams: ApiFootballFixturePlayerStats[],
) {
  const playerRows = teams.flatMap((teamStats) =>
    (teamStats.players ?? [])
      .flatMap((playerStats) => {
        const player = playerStats.player;

        if (!player?.id || !player.name) {
          return [];
        }

        return [
          {
            id: String(player.id),
            name: player.name,
            photo_url: player.photo ?? null,
            updated_at: new Date().toISOString(),
          },
        ];
      }),
  );
  const rows = teams.flatMap((teamStats) => {
    const teamId = teamStats.team?.id ? String(teamStats.team.id) : null;

    return (teamStats.players ?? []).flatMap((playerStats) => {
      const playerName = playerStats.player?.name;

      if (!playerName || !teamId) {
        return [];
      }

      const aggregate = (playerStats.statistics ?? []).reduce(
        (totals, item) => ({
          assists: totals.assists + (item.goals?.assists ?? 0),
          goals: totals.goals + (item.goals?.total ?? 0),
          minutes: totals.minutes + (item.games?.minutes ?? 0),
          redCards: totals.redCards + (item.cards?.red ?? 0),
          saves: totals.saves + (item.goalkeeper?.saves ?? 0),
          yellowCards: totals.yellowCards + (item.cards?.yellow ?? 0),
        }),
        { assists: 0, goals: 0, minutes: 0, redCards: 0, saves: 0, yellowCards: 0 },
      );
      const primaryStat = playerStats.statistics?.[0];

      return [
        {
          assists: aggregate.assists,
          clean_sheets: 0,
          goals: aggregate.goals,
          match_id: String(fixtureId),
          minutes: aggregate.minutes,
          player_id: playerStats.player?.id
            ? String(playerStats.player.id)
            : null,
          player_name: playerName,
          player_photo: playerStats.player?.photo ?? null,
          position: primaryStat?.games?.position ?? null,
          provider_freshness_at: new Date().toISOString(),
          rating: primaryStat?.games?.rating
            ? Number(primaryStat.games.rating)
            : null,
          red_cards: aggregate.redCards,
          saves: aggregate.saves,
          team_id: teamId,
          updated_at: new Date().toISOString(),
          yellow_cards: aggregate.yellowCards,
        },
      ];
    });
  });

  if (rows.length === 0) {
    return;
  }

  if (playerRows.length > 0) {
    await supabase.from("players").upsert(playerRows, { onConflict: "id" });
  }

  await supabase
    .from("match_player_stats")
    .upsert(rows, { onConflict: "match_id,player_id" });

  // Self-heal: drop rows for this fixture whose player_id isn't in the current
  // provider set — clears stale duplicates left by the old name-based key.
  const currentPlayerIds = rows
    .map((row) => row.player_id)
    .filter((id): id is string => Boolean(id));
  if (currentPlayerIds.length > 0) {
    await supabase
      .from("match_player_stats")
      .delete()
      .eq("match_id", String(fixtureId))
      .not(
        "player_id",
        "in",
        `(${currentPlayerIds.map((id) => `"${id}"`).join(",")})`,
      );
  }

  await recalculateTournamentPlayerStats(supabase);
}

async function recalculateTournamentPlayerStats(
  supabase: ReturnType<typeof createClient>,
) {
  const stats = await fetchAllMatchPlayerStats(supabase);
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

  for (const stat of stats ?? []) {
    if (!stat.team_id || !stat.player_name) {
      continue;
    }

    // Group by the stable player_id (fall back to name only when it's missing),
    // so a player whose name was enriched between matches stays one row.
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
      continue;
    }

    current.assists += stat.assists ?? 0;
    current.clean_sheets += stat.clean_sheets ?? 0;
    current.goals += stat.goals ?? 0;
    current.red_cards += stat.red_cards ?? 0;
    current.saves += stat.saves ?? 0;
    current.yellow_cards += stat.yellow_cards ?? 0;
    // Keep the most recent (fullest) name for display.
    if ((stat.updated_at ?? "") >= current.updated_at) {
      current.player_name = stat.player_name;
      current.updated_at = stat.updated_at ?? current.updated_at;
    }
  }

  const rows = [...grouped.values()];

  const { error: deleteError } = await supabase
    .from("tournament_player_stat_snapshots")
    .delete()
    .neq("team_id", "__never__");

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("tournament_player_stat_snapshots")
      .upsert(rows, { onConflict: "team_id,player_id" });

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function fetchAllMatchPlayerStats(
  supabase: ReturnType<typeof createClient>,
) {
  const pageSize = 1000;
  const rows: MatchPlayerStatRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("match_player_stats")
      .select(
        "player_id,player_name,team_id,goals,assists,yellow_cards,red_cards,saves,clean_sheets,updated_at",
      )
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as MatchPlayerStatRow[]));

    if ((data ?? []).length < pageSize) {
      break;
    }
  }

  return rows;
}

async function recalculateFinishedFixtures(
  supabase: ReturnType<typeof createClient>,
  matchIds: string[],
) {
  if (matchIds.length === 0) {
    return;
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("id,home_score,away_score,status,stage")
    .in("id", matchIds)
    .eq("status", "finished");
  const { data: pools } = await supabase
    .from("pools")
    .select("id,scoring_mode,score_prediction_stages")
    .returns<PoolRow[]>();
  const { data: members } = await supabase
    .from("pool_members")
    .select("pool_id,user_id")
    .returns<PoolMemberRow[]>();

  for (const match of matches ?? []) {
    if (match.home_score === null || match.away_score === null) {
      continue;
    }

    const finalResult = determineResult(match.home_score, match.away_score);

    for (const pool of pools ?? []) {
      const { data: predictions } = await supabase
        .from("predictions")
        .select("id,pool_id,match_id,user_id,predicted_result,home_score,away_score")
        .eq("pool_id", pool.id)
        .eq("match_id", match.id)
        .returns<PredictionRow[]>();

      if (!predictions || predictions.length === 0) {
        continue;
      }

      const poolMemberCount =
        members?.filter((member) => member.pool_id === pool.id).length ?? 0;
      const resultWinners = predictions.filter(
        (prediction) => prediction.predicted_result === finalResult,
      );
      const resultShare =
        pool.scoring_mode === "pot" && resultWinners.length > 0
          ? poolMemberCount / resultWinners.length
          : 0;
      // 1X2 stages never award the exact-score bonus.
      const scorePrediction = (pool.score_prediction_stages ?? []).includes(
        stageCategory((match as { stage?: string }).stage ?? ""),
      );

      const scoreRows = predictions.map((prediction) => {
        const exact =
          scorePrediction &&
          prediction.home_score === match.home_score &&
          prediction.away_score === match.away_score;
        const correctResult = prediction.predicted_result === finalResult;
        const points =
          pool.scoring_mode === "pot"
            ? (correctResult ? resultShare : 0) + (exact ? 2 : 0)
            : correctResult
              ? 3 + (exact ? 3 : 0)
              : 0;

        return {
          match_id: match.id,
          points,
          pool_id: pool.id,
          reason: exact
            ? "exact_score"
            : correctResult
              ? pool.scoring_mode === "pot"
                ? "pot_correct_result"
                : "correct_result"
              : "incorrect",
          scoring_mode: pool.scoring_mode,
          user_id: prediction.user_id,
        };
      });

      await supabase
        .from("score_snapshots")
        .upsert(scoreRows, {
          onConflict: "pool_id,match_id,user_id,scoring_mode",
        });
    }
  }
}

function mapFixtureStatus(status: string) {
  if (["1H", "2H", "ET", "P", "BT"].includes(status)) {
    return "live";
  }

  if (status === "HT") {
    return "halftime";
  }

  if (["FT", "AET", "PEN"].includes(status)) {
    return "finished";
  }

  if (status === "PST") {
    return "postponed";
  }

  if (status === "CANC") {
    return "cancelled";
  }

  return "scheduled";
}

function mapQualification(description?: string | null) {
  const normalized = description?.toLowerCase() ?? "";

  if (normalized.includes("qualified") || normalized.includes("next round")) {
    return "qualified";
  }

  if (normalized.includes("eliminated")) {
    return "out";
  }

  return "possible";
}

function normalizeGroupName(value?: string | null) {
  const match = value?.match(/\bGroup\s+([A-L])\b/i);
  return match ? `Group ${match[1].toUpperCase()}` : null;
}

function groupNameFromRound(round?: string) {
  return normalizeGroupName(round);
}

function mapEventType(type: string, detail = "") {
  const normalized = `${type} ${detail}`.toLowerCase();

  if (normalized.includes("card")) {
    return normalized.includes("red") ? "red_card" : "yellow_card";
  }

  if (normalized.includes("subst")) {
    return "substitution";
  }

  // VAR reversals and missed penalties must not count as goals — the score
  // comes from the fixture, and the UI/notifications treat "goal" as real.
  if (
    normalized.includes("disallowed") ||
    normalized.includes("cancelled") ||
    normalized.includes("missed penalty") ||
    type.toLowerCase() === "var"
  ) {
    return "var";
  }

  return "goal";
}

function determineResult(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

function determineResultFromNullableScores(
  homeScore: number | null,
  awayScore: number | null,
) {
  if (homeScore === null || awayScore === null) {
    return null;
  }

  return determineResult(homeScore, awayScore);
}

function uniqueBy<T>(rows: T[], keyForRow: (row: T) => string) {
  return [...new Map(rows.map((row) => [keyForRow(row), row])).values()];
}

function normalizeFixtureTeam(
  fixture: ApiFootballFixture,
  side: "away" | "home",
) {
  const team = fixture.teams[side];
  const id =
    team.id && Number.isFinite(team.id)
      ? String(team.id)
      : `tbd-${fixture.fixture.id}-${side}`;
  const name = team.name?.trim() || "TBD";

  return {
    id,
    logo: team.logo,
    name,
  };
}

const teamAliases: Record<string, { iso2: string; shortName: string }> = {
  // CONMEBOL
  Argentina: { iso2: "ar", shortName: "ARG" },
  Bolivia: { iso2: "bo", shortName: "BOL" },
  Brazil: { iso2: "br", shortName: "BRA" },
  Chile: { iso2: "cl", shortName: "CHI" },
  Colombia: { iso2: "co", shortName: "COL" },
  Ecuador: { iso2: "ec", shortName: "ECU" },
  Paraguay: { iso2: "py", shortName: "PAR" },
  Peru: { iso2: "pe", shortName: "PER" },
  Uruguay: { iso2: "uy", shortName: "URU" },
  Venezuela: { iso2: "ve", shortName: "VEN" },

  // CONCACAF
  Canada: { iso2: "ca", shortName: "CAN" },
  "Costa Rica": { iso2: "cr", shortName: "CRC" },
  Cuba: { iso2: "cu", shortName: "CUB" },
  "El Salvador": { iso2: "sv", shortName: "SLV" },
  Guatemala: { iso2: "gt", shortName: "GUA" },
  Haiti: { iso2: "ht", shortName: "HAI" },
  Honduras: { iso2: "hn", shortName: "HON" },
  Jamaica: { iso2: "jm", shortName: "JAM" },
  Mexico: { iso2: "mx", shortName: "MEX" },
  Panama: { iso2: "pa", shortName: "PAN" },
  "Trinidad & Tobago": { iso2: "tt", shortName: "TRI" },
  "Trinidad and Tobago": { iso2: "tt", shortName: "TRI" },
  USA: { iso2: "us", shortName: "USA" },
  "United States": { iso2: "us", shortName: "USA" },

  // UEFA
  Albania: { iso2: "al", shortName: "ALB" },
  Austria: { iso2: "at", shortName: "AUT" },
  Belgium: { iso2: "be", shortName: "BEL" },
  "Bosnia & Herzegovina": { iso2: "ba", shortName: "BIH" },
  "Bosnia and Herzegovina": { iso2: "ba", shortName: "BIH" },
  "Czech Republic": { iso2: "cz", shortName: "CZE" },
  Czechia: { iso2: "cz", shortName: "CZE" },
  Croatia: { iso2: "hr", shortName: "CRO" },
  Denmark: { iso2: "dk", shortName: "DEN" },
  England: { iso2: "gb-eng", shortName: "ENG" },
  France: { iso2: "fr", shortName: "FRA" },
  Georgia: { iso2: "ge", shortName: "GEO" },
  Germany: { iso2: "de", shortName: "GER" },
  Greece: { iso2: "gr", shortName: "GRE" },
  Hungary: { iso2: "hu", shortName: "HUN" },
  Italy: { iso2: "it", shortName: "ITA" },
  Netherlands: { iso2: "nl", shortName: "NED" },
  "North Macedonia": { iso2: "mk", shortName: "MKD" },
  Norway: { iso2: "no", shortName: "NOR" },
  Poland: { iso2: "pl", shortName: "POL" },
  Portugal: { iso2: "pt", shortName: "POR" },
  Romania: { iso2: "ro", shortName: "ROU" },
  Scotland: { iso2: "gb-sct", shortName: "SCO" },
  Serbia: { iso2: "rs", shortName: "SRB" },
  Slovakia: { iso2: "sk", shortName: "SVK" },
  Slovenia: { iso2: "si", shortName: "SVN" },
  Spain: { iso2: "es", shortName: "ESP" },
  Sweden: { iso2: "se", shortName: "SWE" },
  Switzerland: { iso2: "ch", shortName: "SUI" },
  Turkey: { iso2: "tr", shortName: "TUR" },
  Turkiye: { iso2: "tr", shortName: "TUR" },
  Türkiye: { iso2: "tr", shortName: "TUR" },
  Ukraine: { iso2: "ua", shortName: "UKR" },
  Wales: { iso2: "gb-wls", shortName: "WAL" },

  // AFC
  Australia: { iso2: "au", shortName: "AUS" },
  Bahrain: { iso2: "bh", shortName: "BHR" },
  China: { iso2: "cn", shortName: "CHN" },
  Indonesia: { iso2: "id", shortName: "IDN" },
  Iran: { iso2: "ir", shortName: "IRN" },
  "IR Iran": { iso2: "ir", shortName: "IRN" },
  Iraq: { iso2: "iq", shortName: "IRQ" },
  Japan: { iso2: "jp", shortName: "JPN" },
  Jordan: { iso2: "jo", shortName: "JOR" },
  "Korea Republic": { iso2: "kr", shortName: "KOR" },
  "South Korea": { iso2: "kr", shortName: "KOR" },
  Oman: { iso2: "om", shortName: "OMA" },
  Qatar: { iso2: "qa", shortName: "QAT" },
  "Saudi Arabia": { iso2: "sa", shortName: "KSA" },
  UAE: { iso2: "ae", shortName: "UAE" },
  "United Arab Emirates": { iso2: "ae", shortName: "UAE" },
  Uzbekistan: { iso2: "uz", shortName: "UZB" },

  // CAF
  Algeria: { iso2: "dz", shortName: "ALG" },
  Angola: { iso2: "ao", shortName: "ANG" },
  Benin: { iso2: "bj", shortName: "BEN" },
  Cameroon: { iso2: "cm", shortName: "CMR" },
  "Cape Verde": { iso2: "cv", shortName: "CPV" },
  "Cape Verde Islands": { iso2: "cv", shortName: "CPV" },
  "Curaçao": { iso2: "cw", shortName: "CUR" },
  Curacao: { iso2: "cw", shortName: "CUR" },
  "Congo DR": { iso2: "cd", shortName: "COD" },
  "DR Congo": { iso2: "cd", shortName: "COD" },
  "Cote d'Ivoire": { iso2: "ci", shortName: "CIV" },
  "Côte d'Ivoire": { iso2: "ci", shortName: "CIV" },
  "Ivory Coast": { iso2: "ci", shortName: "CIV" },
  Egypt: { iso2: "eg", shortName: "EGY" },
  Gabon: { iso2: "ga", shortName: "GAB" },
  Ghana: { iso2: "gh", shortName: "GHA" },
  Guinea: { iso2: "gn", shortName: "GUI" },
  Kenya: { iso2: "ke", shortName: "KEN" },
  Mali: { iso2: "ml", shortName: "MLI" },
  Morocco: { iso2: "ma", shortName: "MAR" },
  Mozambique: { iso2: "mz", shortName: "MOZ" },
  Nigeria: { iso2: "ng", shortName: "NGA" },
  Senegal: { iso2: "sn", shortName: "SEN" },
  "South Africa": { iso2: "za", shortName: "RSA" },
  Tanzania: { iso2: "tz", shortName: "TAN" },
  Tunisia: { iso2: "tn", shortName: "TUN" },
  Uganda: { iso2: "ug", shortName: "UGA" },
  Zambia: { iso2: "zm", shortName: "ZMB" },
  Zimbabwe: { iso2: "zw", shortName: "ZIM" },

  // OFC
  "New Zealand": { iso2: "nz", shortName: "NZL" },
};

function shortNameFromTeamName(name: string) {
  return teamAliases[name]?.shortName ?? name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

function iso2FromTeamName(name: string) {
  return teamAliases[name]?.iso2 ?? null;
}
