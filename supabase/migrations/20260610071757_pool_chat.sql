-- Pool chat: messages (plain or vote), vote responses, realtime, RLS.

create table if not exists public.pool_messages (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  mentions uuid[] not null default '{}',
  -- A non-null vote_question makes this message a vote. Options are plain text.
  vote_question text check (vote_question is null or char_length(vote_question) <= 200),
  vote_options text[] check (
    vote_options is null or array_length(vote_options, 1) between 2 and 4
  ),
  vote_closed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((vote_question is null) = (vote_options is null))
);

create index if not exists pool_messages_pool_created_idx
  on public.pool_messages (pool_id, created_at desc);

create table if not exists public.pool_vote_responses (
  message_id uuid not null references public.pool_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.pool_messages enable row level security;
alter table public.pool_vote_responses enable row level security;

drop policy if exists "members can read pool messages" on public.pool_messages;
create policy "members can read pool messages"
  on public.pool_messages for select
  to authenticated
  using (public.is_pool_member(pool_id));

-- Members post their own plain messages directly. Votes (vote_question set)
-- are created through the API with the service role after an admin check.
drop policy if exists "members can post own messages" on public.pool_messages;
create policy "members can post own messages"
  on public.pool_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_pool_member(pool_id)
    and vote_question is null
  );

drop policy if exists "members can read vote responses" on public.pool_vote_responses;
create policy "members can read vote responses"
  on public.pool_vote_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_messages
      where pool_messages.id = pool_vote_responses.message_id
        and public.is_pool_member(pool_messages.pool_id)
    )
  );

-- Live updates for chat.
do $$
begin
  alter publication supabase_realtime add table public.pool_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.pool_vote_responses;
exception when duplicate_object then null;
end $$;
