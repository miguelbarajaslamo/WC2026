// One-off pre-tournament data load for WORLD CUP PICKS.
//
// Pulls the World Cup (API-Football league 1, season 2026) schedule, groups,
// and squads, and writes teams / matches / standings / players / squad members
// / bonus pick options straight into the database. This mirrors the
// `reference` and `squads` modes of supabase/functions/sync-world-cup so we can
// seed real data without deploying the edge function.
//
// Usage:
//   npm i pg --no-save
//   API_FOOTBALL_KEY=xxxx SUPABASE_DB_PASSWORD=yyyy node scripts/sync-reference-data.mjs
//
// Optional flags:
//   --skip-squads   only sync teams/fixtures/standings (2 API requests)
//
// Free tier note: reference = 2 requests, squads = 1 request per team
// (~48). Comfortably under the 100/day free limit.

import pg from "pg";

const API_BASE = "https://v3.football.api-sports.io";
const LEAGUE_ID = 1; // World Cup
const SEASON = 2026;
const LOCK_LEAD_MS = 15 * 60 * 1000;

const apiKey = process.env.API_FOOTBALL_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const skipSquads = process.argv.includes("--skip-squads");

if (!apiKey) {
  console.error("Missing API_FOOTBALL_KEY env var.");
  process.exit(1);
}
if (!dbPassword) {
  console.error("Missing SUPABASE_DB_PASSWORD env var.");
  process.exit(1);
}

const client = new pg.Client({
  host: "aws-0-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.mdwssqojxiejeyokuvgg",
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const teamAliases = {
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

const shortNameFromTeamName = (name) =>
  teamAliases[name]?.shortName ??
  name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
const iso2FromTeamName = (name) => teamAliases[name]?.iso2 ?? null;

const groupNameFromRound = (round) => round?.match(/Group [A-Z]/i)?.[0] ?? null;

function mapFixtureStatus(status) {
  if (["1H", "2H", "ET", "P", "BT"].includes(status)) return "live";
  if (status === "HT") return "halftime";
  if (["FT", "AET", "PEN"].includes(status)) return "finished";
  if (status === "PST") return "postponed";
  if (status === "CANC") return "cancelled";
  return "scheduled";
}

function resultFromScores(home, away) {
  if (home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function mapQualification(description) {
  const n = (description ?? "").toLowerCase();
  if (n.includes("qualified") || n.includes("next round")) return "qualified";
  if (n.includes("eliminated")) return "out";
  return "possible";
}

async function apiFootball(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) {
    throw new Error(`API-Football ${path} failed: ${res.status}`);
  }
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length > 0) {
    throw new Error(`API-Football ${path} error: ${JSON.stringify(body.errors)}`);
  }
  return body;
}

// Generic multi-row upsert. rows: array of plain objects (same keys).
async function upsert(table, rows, conflictCols, updateCols) {
  if (rows.length === 0) return 0;
  const cols = Object.keys(rows[0]);
  const params = [];
  const valuesSql = rows
    .map((row) => {
      const placeholders = cols.map((col) => {
        params.push(row[col]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(",")})`;
    })
    .join(",");
  const updates = updateCols.length
    ? `do update set ${updateCols.map((c) => `${c} = excluded.${c}`).join(", ")}`
    : "do nothing";
  const sql = `insert into public.${table} (${cols.join(",")}) values ${valuesSql}
    on conflict (${conflictCols.join(",")}) ${updates}`;
  await client.query(sql, params);
  return rows.length;
}

function teamRow(id, name, logo) {
  return {
    id: String(id),
    name,
    short_name: shortNameFromTeamName(name),
    iso2: iso2FromTeamName(name),
    flag_url: logo ?? null,
  };
}

async function syncReference() {
  console.log("→ Fetching fixtures…");
  const fixtures = await apiFootball("/fixtures", {
    league: LEAGUE_ID,
    season: SEASON,
  });
  const items = (fixtures.response ?? []).filter((i) => i?.league?.id === LEAGUE_ID);
  console.log(`  ${items.length} fixtures returned.`);

  // Teams from fixtures.
  const teamMap = new Map();
  for (const item of items) {
    for (const side of ["home", "away"]) {
      const t = item.teams?.[side];
      if (t?.id && t?.name) {
        teamMap.set(String(t.id), teamRow(t.id, t.name.trim(), t.logo));
      }
    }
  }
  const teams = [...teamMap.values()];
  await upsert(
    "teams",
    teams,
    ["id"],
    ["name", "short_name", "iso2", "flag_url"],
  );
  console.log(`  Upserted ${teams.length} teams.`);

  // Country-card bonus options.
  await upsert(
    "bonus_pick_options",
    teams.map((t) => ({
      id: `bonus-cards-${t.id}`,
      type: "most_cards_country",
      label: t.name,
      team_id: t.id,
      active: true,
    })),
    ["id"],
    ["label", "team_id", "active"],
  );

  // Matches.
  const matchRows = items
    .filter((i) => i.teams?.home?.id && i.teams?.away?.id)
    .map((i) => {
      const kickoff = i.fixture.date;
      const lock = new Date(new Date(kickoff).getTime() - LOCK_LEAD_MS).toISOString();
      return {
        id: String(i.fixture.id),
        api_football_fixture_id: i.fixture.id,
        home_team_id: String(i.teams.home.id),
        away_team_id: String(i.teams.away.id),
        stage: i.league.round ?? "World Cup",
        group_name: groupNameFromRound(i.league.round),
        venue: i.fixture.venue?.name ?? null,
        city: i.fixture.venue?.city ?? null,
        kickoff_at: kickoff,
        prediction_lock_at: lock,
        status: mapFixtureStatus(i.fixture.status.short),
        provider_status_code: i.fixture.status.short,
        elapsed_minutes: i.fixture.status.elapsed,
        home_score: i.goals.home,
        away_score: i.goals.away,
        winner: resultFromScores(i.goals.home, i.goals.away),
        last_synced_at: new Date().toISOString(),
      };
    });
  await upsert(
    "matches",
    matchRows,
    ["api_football_fixture_id"],
    [
      "home_team_id",
      "away_team_id",
      "stage",
      "group_name",
      "venue",
      "city",
      "kickoff_at",
      "prediction_lock_at",
      "status",
      "provider_status_code",
      "elapsed_minutes",
      "home_score",
      "away_score",
      "winner",
      "last_synced_at",
    ],
  );
  console.log(`  Upserted ${matchRows.length} matches.`);

  // Standings (sets group_name on teams; rows are per-pool).
  console.log("→ Fetching standings…");
  const standings = await apiFootball("/standings", {
    league: LEAGUE_ID,
    season: SEASON,
  });
  const groups = (standings.response ?? []).flatMap(
    (i) => i.league?.standings ?? [],
  );
  const flat = groups.flat();
  console.log(`  ${flat.length} standing rows.`);

  if (flat.length > 0) {
    // Update team group_name from standings.
    const teamGroupRows = flat
      .filter((s) => s.team?.id && s.team?.name)
      .map((s) => ({
        ...teamRow(s.team.id, s.team.name, s.team.logo),
        group_name: s.group ?? null,
      }));
    await upsert(
      "teams",
      teamGroupRows,
      ["id"],
      ["name", "short_name", "iso2", "flag_url", "group_name"],
    );

    const { rows: pools } = await client.query("select id from public.pools");
    const standingRows = pools.flatMap((pool) =>
      flat
        .filter((s) => s.team?.id)
        .map((s) => ({
          pool_id: pool.id,
          team_id: String(s.team.id),
          group_name: s.group ?? "World Cup",
          played: s.all?.played ?? 0,
          won: s.all?.win ?? 0,
          drawn: s.all?.draw ?? 0,
          lost: s.all?.lose ?? 0,
          goals_for: s.all?.goals?.for ?? 0,
          goals_against: s.all?.goals?.against ?? 0,
          points: s.points ?? 0,
          qualification: mapQualification(s.description),
        })),
    );
    await upsert(
      "standings",
      standingRows,
      ["pool_id", "team_id"],
      [
        "group_name",
        "played",
        "won",
        "drawn",
        "lost",
        "goals_for",
        "goals_against",
        "points",
        "qualification",
      ],
    );
    console.log(
      `  Upserted standings for ${pools.length} pool(s) (${standingRows.length} rows).`,
    );
  }
}

async function syncSquads() {
  const { rows: teams } = await client.query(
    "select id, name from public.teams",
  );
  console.log(`→ Fetching squads for ${teams.length} teams…`);
  let playerTotal = 0;

  for (const team of teams) {
    const numericId = Number(team.id);
    if (!Number.isFinite(numericId)) continue;

    let squads;
    try {
      squads = await apiFootball("/players/squads", { team: numericId });
    } catch (err) {
      console.warn(`  ! ${team.name}: ${err.message}`);
      continue;
    }

    const players = [];
    const members = [];
    const options = [];
    for (const squad of squads.response ?? []) {
      const teamId = squad.team?.id ? String(squad.team.id) : null;
      const teamShort = shortNameFromTeamName(squad.team?.name ?? "");
      for (const p of squad.players ?? []) {
        if (!p.id || !p.name) continue;
        const pid = String(p.id);
        players.push({
          id: pid,
          name: p.name,
          photo_url: p.photo ?? null,
          position: p.position ?? null,
          updated_at: new Date().toISOString(),
        });
        if (teamId) {
          members.push({
            team_id: teamId,
            player_id: pid,
            shirt_number: p.number ?? null,
            position: p.position ?? null,
            active: true,
            updated_at: new Date().toISOString(),
          });
          options.push(
            {
              id: `bonus-top-scorer-${pid}`,
              type: "top_scorer",
              label: `${p.name} (${teamShort})`,
              player_id: pid,
              player_name: p.name,
              team_id: teamId,
              active: true,
            },
            {
              id: `bonus-most-assists-${pid}`,
              type: "most_assists",
              label: `${p.name} (${teamShort})`,
              player_id: pid,
              player_name: p.name,
              team_id: teamId,
              active: true,
            },
          );
        }
      }
    }

    await upsert(
      "players",
      players,
      ["id"],
      ["name", "photo_url", "position", "updated_at"],
    );
    await upsert(
      "team_squad_members",
      members,
      ["team_id", "player_id"],
      ["shirt_number", "position", "active", "updated_at"],
    );
    await upsert(
      "bonus_pick_options",
      options,
      ["id"],
      ["label", "player_name", "team_id", "active"],
    );
    playerTotal += players.length;
    console.log(`  ${team.name}: ${players.length} players.`);
  }
  console.log(`→ Squad sync done: ${playerTotal} players.`);
}

async function main() {
  await client.connect();
  try {
    await syncReference();
    if (!skipSquads) {
      await syncSquads();
    } else {
      console.log("→ Skipping squads (--skip-squads).");
    }
    console.log("✓ Sync complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
