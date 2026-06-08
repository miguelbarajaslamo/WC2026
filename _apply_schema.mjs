import pg from "pg";
import { readFile } from "node:fs/promises";

const sql = await readFile("supabase/schema.sql", "utf8");
const client = new pg.Client({
  host: "aws-0-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.mdwssqojxiejeyokuvgg",
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("✓ schema.sql applied successfully.");
} catch (err) {
  console.error("✗ Failed:", err.message);
  if (err.position) {
    const pos = Number(err.position);
    console.error("…near:", JSON.stringify(sql.slice(Math.max(0, pos - 120), pos + 120)));
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
