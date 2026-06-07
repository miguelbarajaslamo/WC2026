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
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

The function polls API-Football live fixtures at a 15-second cadence inside a one-minute invocation and writes a row to `sync_runs`.

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
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

## App Data

The current app uses `/api/bootstrap` with mock data. Replace that endpoint with Supabase reads once auth and pool membership are fully connected. Keep the one-payload bootstrap shape so route switching stays instant and React Query can persist the data locally.
