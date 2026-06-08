// Populate each squad member's pre-tournament stats (season 2026 national-team
// matches: friendlies + qualifiers) from API-Football /players?team&season.
// Stores games, minutes, goals, assists, cards, saves on team_squad_members.
//
// Usage: API_FOOTBALL_KEY=xxx SUPABASE_DB_PASSWORD=yyy node scripts/enrich-player-prewc-stats.mjs

import pg from "pg";

const API_BASE = "https://v3.football.api-sports.io";
const SEASON = 2026;
const apiKey = process.env.API_FOOTBALL_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const PAUSE_MS = 350; // sequential, ~170 req/min, under the 300/min cap

if (!apiKey || !dbPassword) {
  console.error("Missing API_FOOTBALL_KEY or SUPABASE_DB_PASSWORD.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new pg.Client({
  host: "aws-0-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.mdwssqojxiejeyokuvgg",
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

async function fetchPage(teamId, page) {
  const url = new URL(`${API_BASE}/players`);
  url.searchParams.set("team", String(teamId));
  url.searchParams.set("season", String(SEASON));
  url.searchParams.set("page", String(page));
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) throw new Error(`players ${res.status}`);
  return res.json();
}

// Sum the player's statistics rows (one per competition) into one line.
function aggregate(statistics) {
  return (statistics ?? []).reduce(
    (totals, s) => ({
      games: totals.games + (s.games?.appearences ?? 0),
      minutes: totals.minutes + (s.games?.minutes ?? 0),
      goals: totals.goals + (s.goals?.total ?? 0),
      assists: totals.assists + (s.goals?.assists ?? 0),
      yellow: totals.yellow + (s.cards?.yellow ?? 0),
      red: totals.red + (s.cards?.red ?? 0),
      saves: totals.saves + (s.goalkeeper?.saves ?? 0),
    }),
    { games: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, saves: 0 },
  );
}

async function main() {
  await client.connect();
  const { rows: teams } = await client.query("select id, name from public.teams");
  console.log(`Fetching pre-WC stats for ${teams.length} teams…`);

  let updated = 0;
  for (const team of teams) {
    const numericId = Number(team.id);
    if (!Number.isFinite(numericId)) continue;

    try {
      const first = await fetchPage(numericId, 1);
      const pages = first.paging?.total ?? 1;
      const responses = [...(first.response ?? [])];
      for (let page = 2; page <= pages; page += 1) {
        await sleep(PAUSE_MS);
        const next = await fetchPage(numericId, page);
        responses.push(...(next.response ?? []));
      }

      for (const item of responses) {
        const playerId = item.player?.id;
        if (!playerId) continue;
        const stats = aggregate(item.statistics);
        await client.query(
          "update public.team_squad_members set pre_wc_stats = $1::jsonb where team_id = $2 and player_id = $3",
          [JSON.stringify(stats), team.id, String(playerId)],
        );
        updated += 1;
      }
      console.log(`  ${team.name}: ${responses.length} players.`);
    } catch (err) {
      console.warn(`  ! ${team.name}: ${err.message}`);
    }
    await sleep(PAUSE_MS);
  }

  console.log(`✓ Updated pre-WC stats for ${updated} squad members.`);
  await client.end();
}

main().catch((err) => {
  console.error("Pre-WC stats sync failed:", err);
  process.exit(1);
});
