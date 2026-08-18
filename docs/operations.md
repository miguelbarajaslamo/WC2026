# WORLD CUP PICKS Operations

## System admin

Match, event, and stat overrides are restricted to a single operator account,
identified by the `SYSTEM_ADMIN_EMAIL` environment variable on the web app
(Vercel Project Settings, and `.env.local` for development).

The check fails closed: if the variable is unset or empty, the overrides
endpoint returns 403 for everyone. Set it before relying on admin tooling in a
new deployment.

## Demo mode

`/demo` sets a short-lived cookie and drops a visitor into a read-only tour of
the real pool: real matches, real results, real scoring, with member names
replaced by aliases and avatars stripped.

The tour has no Supabase session. Every write endpoint calls `getUser()` and
rejects it, so read-only needs no separate enforcement — **do not add an API
route that writes without checking `getUser()`**.

The seat it looks through is `DEMO_USER_ID`, or the `SYSTEM_ADMIN_EMAIL`
account when that is unset. It reads through the service-role client because
the visitor has no session for RLS to key off, so it requires
`SUPABASE_SERVICE_ROLE_KEY` on the web app, not only on the Edge Functions.

To turn the tour off, remove `/demo` from `PUBLIC_PREFIXES` in `src/proxy.ts`.

## Supabase

Run `supabase/schema.sql` in the SQL editor for the initial schema. The schema includes tables for pools, profiles, teams, matches, match events, match player stats, predictions, standings, score snapshots, bonus picks, invites, sync runs, and admin overrides.

## Scheduled Sync

Vercel Hobby Cron is not used for live polling. Deploy `supabase/functions/sync-world-cup` and schedule it through Supabase Cron with `supabase/cron.sql`.

Required Edge Function secrets:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
CRON_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

The sync function supports modes through the query string:

- `?mode=live`: polls API-Football live fixtures at a 15-second cadence inside a one-minute invocation, syncs events, finished-fixture player stats, and match score snapshots.
- `?mode=reference`: syncs `/fixtures?league=1&season=2026` and `/standings?league=1&season=2026`, including TBD knockout fixtures.
- `?mode=squads`: syncs `/players/squads?team=<team_id>` for known teams, populates players/squad members, and creates top scorer/assist bonus options.
- `?mode=post-match`: refreshes events and `/fixtures/players?fixture=<id>` for finished matches.
- `?mode=stats`: recalculates tournament player stat snapshots.

All modes write a row to `sync_runs`.

Deploy both scheduled functions:

```bash
supabase functions deploy sync-world-cup
supabase functions deploy send-deadline-notifications
```

## Auth Email

Do not use Supabase's built-in email sender for real invites. It is limited to 2 emails per hour. Configure custom SMTP in Supabase Auth using Resend as the planned default:

```bash
Host: smtp.resend.com
Port: 587
Username: resend
Password: <RESEND_API_KEY>
Sender: WORLD CUP PICKS <your-sender-domain>
```

Add the same production and local callback URLs in Supabase Auth URL Configuration.

## Web Push

The app uses the browser Push API and `/public/sw.js`. Users must enable push in Settings or Onboarding. iOS users need to install the PWA to the Home Screen first.

Store these Vercel env vars for the web app:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

Store these Supabase Edge Function secrets for notification delivery:

```bash
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

The client public-key route returns `NEXT_PUBLIC_VAPID_PUBLIC_KEY` first and falls back to `VAPID_PUBLIC_KEY` for local/dev setups. Do not put the VAPID private key in a public Vercel variable.

## App Data

`/api/bootstrap` uses authenticated Supabase reads in production and returns one normalized payload for pool config, profile, members, teams, matches, predictions, events, standings, scoring snapshots, bonus picks, category leaderboards, and sync status. Local development keeps a demo fallback when no Supabase session exists so UI tests can run without sending auth email.
