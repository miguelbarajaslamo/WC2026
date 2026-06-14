-- Reveal other members' tournament specials after lock even when a pool never
-- set bonus_lock_at. The old policy did coalesce(bonus_lock_at, 'infinity'),
-- so a NULL bonus_lock_at (every pool currently) meant others' picks were
-- never readable — they showed "Hidden until lock" forever. Fall back to the
-- first match's pick lock, matching the app's getBonusLockAt().
drop policy if exists "pool members can read own bonus picks before lock and pool bonus picks after lock" on public.bonus_picks;
create policy "pool members can read own bonus picks before lock and pool bonus picks after lock"
  on public.bonus_picks for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = bonus_picks.pool_id
        and pool_members.user_id = auth.uid()
    )
    and (
      user_id = auth.uid()
      or coalesce(
           (select pools.bonus_lock_at from public.pools where pools.id = bonus_picks.pool_id),
           (select min(matches.prediction_lock_at) from public.matches)
         ) <= now()
    )
  );
