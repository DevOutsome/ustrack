-- reset_program_data() never once succeeded.
--
-- The version in 20260913_admin_cleanup.sql deletes whole tables with no WHERE
-- clause. The database refuses that, so every press of Admin > Tools > Reset All
-- Test Data came back as a 500 with "DELETE requires a WHERE clause". Nobody had
-- run it until the first real pre-launch cleanup on 2026-09-14, which is why it
-- sat broken.
--
-- Same behaviour, same super-admin gate, but each delete now carries a predicate
-- that is always true. The counts it returns are still the real deleted rows.

create or replace function public.reset_program_data()
returns table (rsvps bigint, nps_responses bigint, issues bigint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_rsvps bigint;
  n_nps   bigint;
  n_iss   bigint;
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can erase program data';
  end if;

  with d as (delete from public.rsvps where user_id is not null returning 1)
    select count(*) into n_rsvps from d;
  with d as (delete from public.nps_responses where user_id is not null returning 1)
    select count(*) into n_nps from d;
  with d as (delete from public.issues where id is not null returning 1)
    select count(*) into n_iss from d;

  return query select n_rsvps, n_nps, n_iss;
end;
$function$;

revoke all on function public.reset_program_data() from public;
grant execute on function public.reset_program_data() to authenticated;
