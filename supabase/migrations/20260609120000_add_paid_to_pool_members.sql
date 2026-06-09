-- Add paid status tracking for pool entrance fees.
-- Only pool admins can set this; regular members cannot write it at all.

alter table public.pool_members
  add column if not exists paid boolean not null default false;

-- Security-definer helper to check admin role without recursing into the
-- pool_members RLS policies (same pattern as is_pool_member).
create or replace function public.is_pool_admin(p_pool_id uuid)
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
      and pool_members.role = 'admin'
  );
$$;

-- Only pool admins may flip the paid flag (or any other pool_members column).
-- Regular members have no UPDATE policy, so they cannot touch this table at all.
drop policy if exists "Pool admins can update pool_members" on public.pool_members;
create policy "Pool admins can update pool_members"
  on public.pool_members
  for update
  to authenticated
  using (public.is_pool_admin(pool_id))
  with check (public.is_pool_admin(pool_id));
