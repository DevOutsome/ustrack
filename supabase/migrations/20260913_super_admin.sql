-- Super Admin tier + closing a privilege-escalation hole.
--
-- Two separate things, but they touch the same functions so they ship together.
--
-- 1) TIERS
--    Everyone running the program stays role = 'organizer' (15+ existing checks
--    and several RLS policies compare against that exact string, so changing the
--    role value would break Peter everywhere). Instead, super admin is a flag on
--    top of organizer. Only a super admin may erase program data or remove an
--    account that is already approved.
--
-- 2) THE HOLE
--    set_user_role was SECURITY DEFINER, granted to authenticated AND anon, with
--    no caller check at all. Any signed-in participant could POST to
--    /rest/v1/rpc/set_user_role with the public anon key and make themselves an
--    organizer. The API route checked the caller, but the RPC was reachable
--    directly, so the check never applied.

-- ── 1. The flag ─────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists is_super_admin boolean not null default false;

update public.users set is_super_admin = true where email = 'peter@outsome.co';

create or replace function public.is_super_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_super_admin from public.users where id = user_id), false);
$$;

revoke all on function public.is_super_admin(uuid) from public, anon;
grant execute on function public.is_super_admin(uuid) to authenticated;

-- ── 2. set_user_role: was unguarded ─────────────────────────────────────────
create or replace function public.set_user_role(target_email text, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if public.get_user_role(auth.uid()) is distinct from 'organizer' then
    raise exception 'Only organisers can change roles';
  end if;

  if new_role not in ('organizer','participant','speaker','vc') then
    raise exception 'Invalid role: %', new_role;
  end if;

  select id into target_id from public.users where email = target_email;
  if target_id is null then
    raise exception 'User not found';
  end if;

  -- An ordinary admin must not be able to demote the super admin.
  if public.is_super_admin(target_id) and not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can change a super admin';
  end if;

  update public.profiles set role = new_role, updated_at = now() where email = target_email;
  update public.users    set role = new_role where email = target_email;
end;
$$;

revoke all on function public.set_user_role(text, text) from public, anon;
grant execute on function public.set_user_role(text, text) to authenticated;

-- ── 3. set_user_approved: protect the super admin ───────────────────────────
create or replace function public.set_user_approved(target_email text, is_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if public.get_user_role(auth.uid()) is distinct from 'organizer' then
    raise exception 'Only organisers can change approval';
  end if;

  select id into target_id from public.users where email = target_email;
  if target_id is null then
    raise exception 'User not found';
  end if;

  if public.is_super_admin(target_id) and not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can change a super admin';
  end if;

  update public.users
     set approved = is_approved,
         approved_at = case when is_approved then now() else null end,
         approved_by = case when is_approved then (select email from public.users where id = auth.uid()) else null end
   where email = target_email;
end;
$$;

revoke all on function public.set_user_approved(text, boolean) from public, anon;
grant execute on function public.set_user_approved(text, boolean) to authenticated;

-- ── 4. Erasing program data is super-admin only ─────────────────────────────
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
  if not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can erase program data';
  end if;

  with d as (delete from public.rsvps returning 1)          select count(*) into n_rsvps from d;
  with d as (delete from public.nps_responses returning 1)  select count(*) into n_nps   from d;
  with d as (delete from public.issues returning 1)         select count(*) into n_iss   from d;

  return query select n_rsvps, n_nps, n_iss;
end;
$$;

revoke all on function public.reset_program_data() from public, anon;
grant execute on function public.reset_program_data() to authenticated;

-- ── 5. Account removal: pending is admin work, approved is not ──────────────
create or replace function public.delete_user_account(target_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  target_approved boolean;
begin
  if public.get_user_role(auth.uid()) is distinct from 'organizer' then
    raise exception 'Only organisers can remove accounts';
  end if;

  select id, approved into target_id, target_approved
    from public.users where email = target_email;
  if target_id is null then
    return false;
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  if public.is_super_admin(target_id) then
    raise exception 'The super admin account cannot be removed';
  end if;

  -- Turning away a pending signup is routine. Deleting someone who is already in
  -- the program destroys their RSVPs and feedback, so that needs a super admin.
  if target_approved and not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can remove an approved member';
  end if;

  delete from public.rsvps          where user_id = target_id;
  delete from public.nps_responses  where user_id = target_id;
  delete from public.issues         where user_id = target_id;
  delete from public.users          where id = target_id;

  return true;
end;
$$;

revoke all on function public.delete_user_account(text) from public, anon;
grant execute on function public.delete_user_account(text) to authenticated;

-- ── 6. The old reject path is superseded; stop exposing it ──────────────────
revoke all on function public.reject_pending_user(text) from public, anon, authenticated;
