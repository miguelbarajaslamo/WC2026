-- Fix infinite recursion in the pool_members SELECT policy.
--
-- The previous policy queried public.pool_members inside its own USING clause,
-- which made Postgres re-evaluate the policy to satisfy the subquery, forever
-- (error 42P17: "infinite recursion detected in policy for relation
-- pool_members"). This broke /api/bootstrap for every authenticated user.
--
-- The lookup now goes through a security-definer function so it bypasses RLS on
-- pool_members and cannot recurse.

create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.pool_members
    where pool_members.pool_id = p_pool_id
      and pool_members.user_id = auth.uid()
  );
$$;

drop policy if exists "members can read pool memberships" on public.pool_members;
create policy "members can read pool memberships"
  on public.pool_members for select
  to authenticated
  using (public.is_pool_member(pool_id));
