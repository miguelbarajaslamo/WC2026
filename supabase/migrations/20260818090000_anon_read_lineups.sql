-- Starting XIs are public football data: published by the tournament and
-- fetched from API-Football, with nothing personal to the pool in them.
-- Reading them does not need a session, and the read-only /demo tour has none.
--
-- Scope stays deliberately narrow: SELECT only, this table only. Writes remain
-- service-role only through the sync function.
drop policy if exists "anon can read lineups" on public.match_lineups;
create policy "anon can read lineups"
  on public.match_lineups for select
  to anon
  using (true);
