# WORLD CUP PICKS Operations

## Supabase

Run `supabase/schema.sql` in the SQL editor for the initial schema. The schema includes tables for pools, profiles, teams, matches, predictions, standings, score snapshots, invites, sync runs, and admin overrides.

## Scheduled Sync

Vercel Hobby Cron is not used for live polling. Deploy `supabase/functions/sync-world-cup` and schedule it through Supabase Cron with `supabase/cron.sql`.

Required Edge Function secrets:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
CRON_SECRET=
```

The function polls API-Football live fixtures at a 15-second cadence inside a one-minute invocation and writes a row to `sync_runs`.

## App Data

The current app uses `/api/bootstrap` with mock data. Replace that endpoint with Supabase reads once auth and pool membership are fully connected. Keep the one-payload bootstrap shape so route switching stays instant and React Query can persist the data locally.
