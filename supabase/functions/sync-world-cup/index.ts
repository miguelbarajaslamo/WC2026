import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const apiFootballBaseUrl = "https://v3.football.api-sports.io";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SyncResult = {
  requestsUsed: number;
  message: string;
};

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

Deno.serve(async (request) => {
  const startedAt = new Date().toISOString();
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = request.headers.get("Authorization") ?? "";

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
      source: "api-football",
      started_at: startedAt,
      status: "ok",
    })
    .select("id")
    .single();

  try {
    const result = await runLiveLoop(supabase);

    if (syncRun?.id) {
      await supabase
        .from("sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          message: result.message,
          requests_used: result.requestsUsed,
          status: "ok",
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

async function runLiveLoop(supabase: ReturnType<typeof createClient>): Promise<SyncResult> {
  let requestsUsed = 0;

  for (let tick = 0; tick < 4; tick += 1) {
    const liveFixtures = await fetchApiFootball("/fixtures", { live: "all" });
    requestsUsed += 1;

    await upsertLiveFixtures(supabase, liveFixtures.response ?? []);

    if (tick < 3) {
      await sleep(15_000);
    }
  }

  return {
    message: "Live fixtures polled at 15 second cadence.",
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
) {
  const worldCupFixtures = fixtures.filter((item) => item?.league?.id === 1);

  if (worldCupFixtures.length === 0) {
    return;
  }

  const teamRows = worldCupFixtures.flatMap((item) => [
    {
      flag_url: item.teams.home.logo,
      id: String(item.teams.home.id),
      name: item.teams.home.name,
      short_name: item.teams.home.name.slice(0, 3).toUpperCase(),
    },
    {
      flag_url: item.teams.away.logo,
      id: String(item.teams.away.id),
      name: item.teams.away.name,
      short_name: item.teams.away.name.slice(0, 3).toUpperCase(),
    },
  ]);

  await supabase.from("teams").upsert(teamRows, { onConflict: "id" });

  const rows = worldCupFixtures.map((item) => {
    const kickoffAt = item.fixture.date;
    const predictionLockAt = new Date(
      new Date(kickoffAt).getTime() - 15 * 60 * 1000,
    ).toISOString();

    return {
      api_football_fixture_id: item.fixture.id,
      away_score: item.goals.away,
      away_team_id: String(item.teams.away.id),
      city: item.fixture.venue?.city,
      elapsed_minutes: item.fixture.status.elapsed,
      home_score: item.goals.home,
      home_team_id: String(item.teams.home.id),
      id: String(item.fixture.id),
      kickoff_at: kickoffAt,
      last_synced_at: new Date().toISOString(),
      prediction_lock_at: predictionLockAt,
      provider_status_code: item.fixture.status.short,
      stage: item.league.round ?? "World Cup",
      status: mapFixtureStatus(item.fixture.status.short),
      updated_at: new Date().toISOString(),
      venue: item.fixture.venue?.name,
    };
  });

  await supabase
    .from("matches")
    .upsert(rows, { onConflict: "api_football_fixture_id" });
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
