-- Per-user "quiet hours" for push reminders. Opt-in: when enabled, a pick
-- reminder that would fire outside [start, end) local time is delivered just
-- before the window closes on the latest day still before the deadline.
alter table public.profiles
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start smallint not null default 9,
  add column if not exists quiet_hours_end smallint not null default 23,
  add column if not exists timezone text;

-- start in 0..23, end in 1..24 (24 = midnight), and the window must be non-empty.
alter table public.profiles
  drop constraint if exists profiles_quiet_hours_range_chk;
alter table public.profiles
  add constraint profiles_quiet_hours_range_chk
  check (
    quiet_hours_start >= 0
    and quiet_hours_start <= 23
    and quiet_hours_end >= 1
    and quiet_hours_end <= 24
    and quiet_hours_start < quiet_hours_end
  );
