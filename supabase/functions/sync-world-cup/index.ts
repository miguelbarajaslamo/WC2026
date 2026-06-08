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
  | "post-match"
  | "reference"
  | "squads"
  | "stats"
  | "form";

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
    name?: string | null;
  };
  comments?: string | null;
  detail?: string;
  player?: {
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
  // Skip the API entirely when nothing is in play: a match counts as "in
  // window" if it's live/halftime, or kicked off in the last ~3.5h and isn't
  // finished yet. This keeps idle minutes at zero API requests.
  const windowStart = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const { data: inWindow } = await supabase
    .from("matches")
    .select("id")
    .in("status", ["live", "halftime", "scheduled"])
    .gte("kickoff_at", windowStart)
    .lte("kickoff_at", windowEnd)
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

async function runReferenceSync(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  let requestsUsed = 0;

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
    normalizedFixtureTeams.map((team) => ({
      flag_url: team.logo,
      id: team.id,
      iso2: iso2FromTeamName(team.name),
      name: team.name,
      short_name: shortNameFromTeamName(team.name),
    })),
    (row) => row.id,
  );

  await supabase.from("teams").upsert(teamRows, { onConflict: "id" });
  await upsertCountryCardBonusOptions(supabase, teamRows);

  const rows = worldCupFixtures.map((item) => {
    const kickoffAt = item.fixture.date;
    const homeTeam = normalizeFixtureTeam(item, "home");
    const awayTeam = normalizeFixtureTeam(item, "away");
    const predictionLockAt = new Date(
      new Date(kickoffAt).getTime() - 15 * 60 * 1000,
    ).toISOString();

    return {
      api_football_fixture_id: item.fixture.id,
      away_score: item.goals.away,
      away_team_id: awayTeam.id,
      city: item.fixture.venue?.city,
      elapsed_minutes: item.fixture.status.elapsed,
      group_name: groupNameFromRound(item.league.round),
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

  const teamRows = standings
    .filter((standing) => standing.team?.id && standing.team.name)
    .map((standing) => {
      const teamName = standing.team?.name ?? "TBD";

      return {
        flag_url: standing.team?.logo,
        group_name: standing.group ?? null,
        id: String(standing.team?.id),
        iso2: iso2FromTeamName(teamName),
        name: teamName,
        short_name: shortNameFromTeamName(teamName),
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
      .map((standing) => ({
        drawn: standing.all?.draw ?? 0,
        goals_against: standing.all?.goals?.against ?? 0,
        goals_for: standing.all?.goals?.for ?? 0,
        group_name: standing.group ?? "World Cup",
        lost: standing.all?.lose ?? 0,
        played: standing.all?.played ?? 0,
        points: standing.points ?? 0,
        pool_id: pool.id,
        qualification: mapQualification(standing.description),
        team_id: String(standing.team?.id),
        updated_at: new Date().toISOString(),
        won: standing.all?.win ?? 0,
      })),
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

  const rows = events
    .filter((event) => event.type)
    .map((event, index) => {
      const elapsed = event.time?.elapsed ?? 0;
      const extra = event.time?.extra ?? null;
      const playerName = event.player?.name ?? "";
      const detail = event.detail ?? event.comments ?? "";
      const eventType = mapEventType(event.type ?? "", detail);

      return {
        assist_name: event.assist?.name,
        detail,
        elapsed_minutes: elapsed,
        event_type: eventType,
        match_id: String(fixtureId),
        player_name: playerName,
        provider_event_id: [
          fixtureId,
          elapsed,
          extra ?? 0,
          event.team?.id ?? 0,
          eventType,
          playerName,
          detail,
          index,
        ].join(":"),
        stoppage_minutes: extra,
        team_id: event.team?.id ? String(event.team.id) : null,
      };
    });

  await supabase
    .from("match_events")
    .upsert(rows, { onConflict: "match_id,provider_event_id" });
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
    .upsert(rows, { onConflict: "match_id,team_id,player_name" });

  await recalculateTournamentPlayerStats(supabase);
}

async function recalculateTournamentPlayerStats(
  supabase: ReturnType<typeof createClient>,
) {
  const { data: stats } = await supabase
    .from("match_player_stats")
    .select(
      "player_id,player_name,team_id,goals,assists,yellow_cards,red_cards,saves,clean_sheets,updated_at",
    );
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

    const key = `${stat.team_id}:${stat.player_name}`;
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
    current.updated_at = stat.updated_at ?? current.updated_at;
  }

  const rows = [...grouped.values()];

  if (rows.length > 0) {
    await supabase
      .from("tournament_player_stat_snapshots")
      .upsert(rows, { onConflict: "player_name,team_id" });
  }
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

function groupNameFromRound(round?: string) {
  const match = round?.match(/Group [A-Z]/i);
  return match?.[0] ?? null;
}

function mapEventType(type: string, detail = "") {
  const normalized = `${type} ${detail}`.toLowerCase();

  if (normalized.includes("card")) {
    return normalized.includes("red") ? "red_card" : "yellow_card";
  }

  if (normalized.includes("subst")) {
    return "substitution";
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
  Argentina: { iso2: "ar", shortName: "ARG" },
  Australia: { iso2: "au", shortName: "AUS" },
  Belgium: { iso2: "be", shortName: "BEL" },
  Brazil: { iso2: "br", shortName: "BRA" },
  Canada: { iso2: "ca", shortName: "CAN" },
  Chile: { iso2: "cl", shortName: "CHI" },
  Colombia: { iso2: "co", shortName: "COL" },
  Croatia: { iso2: "hr", shortName: "CRO" },
  Denmark: { iso2: "dk", shortName: "DEN" },
  Ecuador: { iso2: "ec", shortName: "ECU" },
  England: { iso2: "gb-eng", shortName: "ENG" },
  France: { iso2: "fr", shortName: "FRA" },
  Germany: { iso2: "de", shortName: "GER" },
  Ghana: { iso2: "gh", shortName: "GHA" },
  Italy: { iso2: "it", shortName: "ITA" },
  Japan: { iso2: "jp", shortName: "JPN" },
  Mexico: { iso2: "mx", shortName: "MEX" },
  Morocco: { iso2: "ma", shortName: "MAR" },
  Netherlands: { iso2: "nl", shortName: "NED" },
  Norway: { iso2: "no", shortName: "NOR" },
  Poland: { iso2: "pl", shortName: "POL" },
  Portugal: { iso2: "pt", shortName: "POR" },
  Senegal: { iso2: "sn", shortName: "SEN" },
  Spain: { iso2: "es", shortName: "ESP" },
  Sweden: { iso2: "se", shortName: "SWE" },
  Switzerland: { iso2: "ch", shortName: "SUI" },
  Uruguay: { iso2: "uy", shortName: "URU" },
  USA: { iso2: "us", shortName: "USA" },
};

function shortNameFromTeamName(name: string) {
  return teamAliases[name]?.shortName ?? name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

function iso2FromTeamName(name: string) {
  return teamAliases[name]?.iso2 ?? null;
}
