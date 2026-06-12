update public.teams
set group_name = null
where group_name is not null
  and group_name !~* '^Group [A-L]$';

update public.matches
set group_name = null
where group_name is not null
  and group_name !~* '^Group [A-L]$';

delete from public.standings
where group_name !~* '^Group [A-L]$';
