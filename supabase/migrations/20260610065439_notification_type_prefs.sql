-- Per-type notification preferences. Pick reminders stay on by default
-- (notification_deadlines already defaults true); the new event types are
-- opt-in (default false).
alter table public.profiles
  add column if not exists notification_match_locks boolean not null default false,
  add column if not exists notification_full_time boolean not null default false;
