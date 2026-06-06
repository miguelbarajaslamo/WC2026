# Family Cup 2026

A mobile-first PWA for a private World Cup prediction pool.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Vercel deployment
- API-Football for World Cup data

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Supabase

1. Create or open the Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Add the values to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `API_FOOTBALL_KEY`
   - `CRON_SECRET`

## Vercel

Import the repository in Vercel after the first auth flow works locally. Add the same env vars in Project Settings.

## Product Plan

See `docs/implementation-plan.md`.
