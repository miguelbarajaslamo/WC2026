// One-off: replace abbreviated squad names ("E. Haaland") with full names
// ("Erling Braut Haaland") so players are searchable by first or last name.
//
// The /players/squads endpoint only returns abbreviated names; full names come
// from /players/profiles?player=ID (one call per player). Paced under the
// 300 req/min limit. After updating players, the top-scorer / most-assists
// pick option labels are regenerated from the new names.
//
// Usage: API_FOOTBALL_KEY=xxx SUPABASE_DB_PASSWORD=yyy node scripts/enrich-player-names.mjs

import pg from "pg";

const API_BASE = "https://v3.football.api-sports.io";
const apiKey = process.env.API_FOOTBALL_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const BATCH = 4;
const PAUSE_MS = 1000; // 4 req/sec ≈ 240/min, safely under the 300/min cap

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

async function fullName(playerId) {
  try {
    const res = await fetch(`${API_BASE}/players/profiles?player=${playerId}`, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const player = body.response?.[0]?.player;
    if (!player) return null;
    const name = [player.firstname, player.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || null;
  } catch {
    return null;
  }
}

async function main() {
  await client.connect();
  const { rows: players } = await client.query("select id from public.players");
  console.log(`Enriching ${players.length} players…`);

  const updates = [];
  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH);
    const names = await Promise.all(batch.map((p) => fullName(p.id)));
    batch.forEach((p, idx) => {
      if (names[idx]) updates.push({ id: String(p.id), name: names[idx] });
    });
    if (i % 100 === 0) {
      console.log(`  ${i}/${players.length} (${updates.length} resolved)…`);
    }
    await sleep(PAUSE_MS);
  }

  console.log(`Resolved ${updates.length} full names. Updating database…`);

  // Bulk update player names in chunks.
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    const params = [];
    const values = chunk
      .map((u) => {
        params.push(u.id, u.name);
        return `($${params.length - 1}, $${params.length})`;
      })
      .join(",");
    await client.query(
      `update public.players p set name = v.name
       from (values ${values}) as v(id, name)
       where p.id = v.id`,
      params,
    );
  }

  // Regenerate pick option labels from the new names.
  const { rowCount } = await client.query(
    `update public.bonus_pick_options o
       set player_name = p.name,
           label = p.name || ' (' || t.short_name || ')'
       from public.players p, public.teams t
      where o.player_id = p.id and o.team_id = t.id
        and o.type in ('top_scorer', 'most_assists')`,
  );
  console.log(`Regenerated ${rowCount} pick option labels.`);

  await client.end();
  console.log("✓ Done.");
}

main().catch((err) => {
  console.error("Enrichment failed:", err);
  process.exit(1);
});
