# WORLD CUP PICKS Implementation Plan

## Summary

Build a mobile-first PWA named WORLD CUP PICKS for a private World Cup prediction pool. The app should feel like a serious football companion app: Today is the home screen, Match Detail is the live social center, and Fixtures/My Picks make it fast to fill predictions before lock.

Data comes from Supabase for the client. API-Football is called only from server-side sync jobs, with the free tier used during development and the Pro plan used during live tournament polling.

## Core Product

- Bottom navigation: Today, Fixtures, Leaderboard, Picks.
- Secondary areas: Pool/Rules, Groups, Stats/Categories, Profile/Settings, Admin.
- Predictions are editable until `kickoff_at - 15 minutes`.
- Picks become visible to everyone at lock.
- Users are encouraged to fill all group-stage picks early; those picks remain editable per match until lock.
- Admin can choose `traditional` or `pot` scoring before the tournament and lock that choice.

## Supabase Setup

- Run `supabase/schema.sql` in the Supabase SQL editor.
- Add app env vars from `.env.example`.
- Use Supabase Auth, preferably magic link/email OTP for simplicity.
- Keep all API-Football keys server-only.
- Use RLS so users can see only their own predictions before lock, then everyone’s locked predictions after lock.

## Vercel Setup

- Import the repo into Vercel once the first auth flow works locally.
- Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `API_FOOTBALL_KEY`, and `CRON_SECRET`.
- Do not rely on Vercel Hobby Cron for live polling. Deploy the Supabase Edge Function and schedule it with Supabase Cron.

## Build Phases

1. **Foundation**
   - Finish route structure for Today, Fixtures, Leaderboard, My Picks, Match Detail, Admin.
   - Add Supabase auth and profile creation.
   - Add one default pool and membership invite flow.

2. **Prediction Flow**
   - Import fixtures/teams from mock data first.
   - Build match prediction form with result selector and score steppers.
   - Enforce lock time in database and UI.
   - Reveal group picks after lock.

3. **Scoring**
   - Implement traditional scoring.
   - Implement pot scoring in parallel.
   - Store per-match score snapshots.
   - Build leaderboard totals from snapshots.
   - Add tournament specials for champion, finalists, top scorer, most assists, and most-carded country.

4. **Live Data**
   - Add API-Football client on the server.
   - Store provider responses during development for mocks.
   - Sync fixtures, match status, scores, events, and finished-fixture player stats.
   - Build category leaderboards for top scorers, top assists, and country card points.
   - Add admin override and recalculation.

5. **PWA Polish**
   - Add install helper.
   - Add proper app icons once the visual identity is settled.
   - Add loading/empty/error states.
   - Add optional deadline reminders and live notifications later.

## Acceptance Tests

- A user can join, create a profile, and see Today.
- A user can save and edit a prediction before lock.
- A user cannot edit after lock.
- Other users’ picks are hidden before lock and visible after lock.
- Traditional and pot scoring produce expected points for the same match.
- Leaderboard updates after a match finishes and after admin recalculation.
- API sync updates match status/scores without exposing the provider key.
