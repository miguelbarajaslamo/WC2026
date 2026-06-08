// Refresh each team's recent form (last 5 finished matches) from API-Football.
// Re-runnable: call it now and again after each matchday to keep form current.
//
// Usage: API_FOOTBALL_KEY=xxx SUPABASE_DB_PASSWORD=yyy node scripts/enrich-team-form.mjs

import pg from "pg";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const BATCH = 4;
const PAUSE_MS = 1000; // ~240 req/min, under the 300/min cap

if (!apiKey || !dbPassword) {
  console.error("Missing API_FOOTBALL_KEY or SUPABASE_DB_PASSWORD.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FINISHED = new Set(["FT", "AET", "PEN"]);

const client = new pg.Client({
  host: "aws-0-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.mdwssqojxiejeyokuvgg",
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

async function teamForm(teamId) {
  const url = new URL(`${API_BASE}/fixtures`);
  url.searchParams.set("team", String(teamId));
  url.searchParams.set("last", "5");
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) return [];
  const body = await res.json();

  const entries = (body.response ?? [])
    .filter(
      (item) =>
        FINISHED.has(item.fixture?.status?.short) &&
        item.goals?.home != null &&
        item.goals?.away != null,
    )
    .map((item) => {
      const isHome = String(item.teams?.home?.id) === String(teamId);
      const gf = isHome ? item.goals.home : item.goals.away;
      const ga = isHome ? item.goals.away : item.goals.home;
      const opponent = isHome ? item.teams?.away?.name : item.teams?.home?.name;
      return {
        date: item.fixture.date,
        competition: item.league?.name ?? "",
        opponent: opponent ?? "TBD",
        gf,
        ga,
        result: gf > ga ? "W" : gf < ga ? "L" : "D",
      };
    });

  // Chronological (oldest → newest) so the squares read left to right.
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}

async function main() {
  await client.connect();
  const { rows: teams } = await client.query("select id, name from public.teams");
  console.log(`Refreshing form for ${teams.length} teams…`);

  let done = 0;
  for (let i = 0; i < teams.length; i += BATCH) {
    const batch = teams.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (team) => {
        const numericId = Number(team.id);
        if (!Number.isFinite(numericId)) return;
        try {
          const form = await teamForm(numericId);
          await client.query(
            "update public.teams set recent_form = $1::jsonb where id = $2",
            [JSON.stringify(form), team.id],
          );
          done += 1;
        } catch (err) {
          console.warn(`  ! ${team.name}: ${err.message}`);
        }
      }),
    );
    await sleep(PAUSE_MS);
  }

  console.log(`✓ Updated form for ${done} teams.`);
  await client.end();
}

main().catch((err) => {
  console.error("Form sync failed:", err);
  process.exit(1);
});
