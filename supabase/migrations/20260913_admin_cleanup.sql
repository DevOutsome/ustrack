-- Admin cleanup: announcements policies, honest test-data reset, real account deletion.
--
-- Three things were reporting success while doing nothing:
--   1. Admin > Announcements > Post          -> 500, the table had no created_by column
--   2. Admin > Tools > Reset Test Data       -> RLS allows deleting only your own rows,
--                                               but the API reported the SELECT count
--   3. Admin > All Users > Reject            -> returned success, the row stayed
--
-- Deletes that cross user boundaries cannot go through RLS here (there is no
-- organiser DELETE policy, and adding a policy with a subquery on the same table
-- is what caused the recursion bug on public.profiles). They go through
-- SECURITY DEFINER functions that check the caller's role with get_user_role.

-- ── 1. Announcements ────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Everyone signed in reads them; only organisers write.
drop policy if exists "ann_select_authenticated" on public.announcements;
create policy "ann_select_authenticated"
  on public.announcements for select to authenticated using (true);

drop policy if exists "ann_insert_organizer" on public.announcements;
create policy "ann_insert_organizer"
  on public.announcements for insert to authenticated
  with check (public.get_user_role(auth.uid()) = 'organizer');

drop policy if exists "ann_update_organizer" on public.announcements;
create policy "ann_update_organizer"
  on public.announcements for update to authenticated
  using (public.get_user_role(auth.uid()) = 'organizer')
  with check (public.get_user_role(auth.uid()) = 'organizer');

drop policy if exists "ann_delete_organizer" on public.announcements;
create policy "ann_delete_organizer"
  on public.announcements for delete to authenticated
  using (public.get_user_role(auth.uid()) = 'organizer');

-- ── 2. Honest test-data reset ───────────────────────────────────────────────
-- Returns what it actually deleted, so the UI can stop guessing.
create or replace function public.reset_program_data()
returns table (rsvps bigint, nps_responses bigint, issues bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  n_rsvps bigint;
  n_nps   bigint;
  n_iss   bigint;
begin
  if public.get_user_role(auth.uid()) <> 'organizer' then
    raise exception 'Only organisers can reset program data';
  end if;

  with d as (delete from public.rsvps returning 1)          select count(*) into n_rsvps from d;
  with d as (delete from public.nps_responses returning 1)  select count(*) into n_nps   from d;
  with d as (delete from public.issues returning 1)         select count(*) into n_iss   from d;

  return query select n_rsvps, n_nps, n_iss;
end;
$$;

revoke all on function public.reset_program_data() from public;
grant execute on function public.reset_program_data() to authenticated;

-- ── 3. Real account deletion ────────────────────────────────────────────────
-- Removes the roster row and everything keyed to it. The auth.users row is left
-- alone on purpose: this project cannot assume the service role is available at
-- runtime, and a signed-out auth record with no public.users row simply lands
-- back in the approval queue if the person signs up again.
create or replace function public.delete_user_account(target_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if public.get_user_role(auth.uid()) <> 'organizer' then
    raise exception 'Only organisers can remove accounts';
  end if;

  select id into target_id from public.users where email = target_email;
  if target_id is null then
    return false;
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  delete from public.rsvps          where user_id = target_id;
  delete from public.nps_responses  where user_id = target_id;
  delete from public.issues         where user_id = target_id;
  delete from public.users          where id = target_id;

  return true;
end;
$$;

revoke all on function public.delete_user_account(text) from public;
grant execute on function public.delete_user_account(text) to authenticated;
