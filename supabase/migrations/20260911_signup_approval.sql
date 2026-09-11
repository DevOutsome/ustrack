-- ============================================================================
-- Signup approval queue (2026-09-11)
--
-- Until now `shouldCreateUser: true` meant anyone who knew the URL could sign in
-- and immediately see the accommodation address, the Wi-Fi password, organiser
-- phone numbers, the full speaker line-up and the People directory - and could
-- RSVP, which feeds the meal headcount someone shops against.
--
-- Rather than maintaining an invite list, new accounts land in a pending state.
-- An organiser approves them with one tap in Admin > All Users.
-- ============================================================================

alter table public.users add column if not exists approved boolean not null default false;
alter table public.users add column if not exists approved_at timestamptz;
alter table public.users add column if not exists approved_by text;

comment on column public.users.approved is
  'False until an organiser admits this account. Gates the portal and every data API.';

create index if not exists users_approved_idx on public.users (approved);

-- Everyone who already had access keeps it; this must not lock out the team.
update public.users
set approved = true,
    approved_at = coalesce(approved_at, now()),
    approved_by = coalesce(approved_by, 'backfill 2026-09-11')
where approved = false;

-- Organiser emails are trusted on sign-up; everyone else waits.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  is_team boolean := new.email in (
    'peter@outsome.co', 'alice.yoo@outsome.co', 'bernice@outsome.co', 'seo@outsome.co'
  );
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when is_team then 'organizer' else 'participant' end)
  on conflict (id) do nothing;

  insert into public.users (id, email, display_name, role, approved, approved_at, approved_by)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    case when is_team then 'organizer' else 'participant' end,
    is_team,
    case when is_team then now() else null end,
    case when is_team then 'auto (team email)' else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- Approval is an organiser action. SECURITY DEFINER so the policy layer does not
-- have to reason about cross-table role lookups.
create or replace function public.set_user_approved(target_email text, is_approved boolean)
returns void
language plpgsql
security definer
as $function$
declare
  caller_role text;
begin
  select role into caller_role from public.users where id = auth.uid();
  if caller_role is distinct from 'organizer' then
    raise exception 'Only organizers can change approval';
  end if;

  update public.users
  set approved = is_approved,
      approved_at = case when is_approved then now() else null end,
      approved_by = case when is_approved then (select email from public.users where id = auth.uid()) else null end
  where email = target_email;
end;
$function$;

grant execute on function public.set_user_approved(text, boolean) to authenticated;

-- Read own approval state without tripping over RLS.
create or replace function public.is_approved(user_id uuid)
returns boolean
language sql
security definer
stable
as $function$
  select coalesce((select approved from public.users where id = user_id), false);
$function$;

grant execute on function public.is_approved(uuid) to authenticated, anon;
