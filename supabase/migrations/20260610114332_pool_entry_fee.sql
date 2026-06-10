-- Pool pot: a per-member entry fee and the Swish number to pay it to.
-- The pot is entry_fee × members marked paid (paid already exists on
-- pool_members). Only the pool owner edits these (handled in the API).
alter table public.pools
  add column if not exists entry_fee integer not null default 0,
  add column if not exists swish_number text;
