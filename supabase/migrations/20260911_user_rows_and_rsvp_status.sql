-- ============================================================================
-- public.users population + RSVP status vocabulary (2026-09-11)
--
-- Two blockers found while wiring RSVP persistence:
--
-- 1. rsvps.user_id has a FK to public.users(id), but the signup trigger only
--    ever wrote to public.profiles. public.users was empty (0 rows against 4
--    auth users), so NO RSVP could be inserted at all.
--
-- 2. rsvps.status has CHECK (status IN ('attending','not_attending')). The UI
--    speaks 'yes'/'no'; the API route translates between the two so the database
--    keeps the explicit vocabulary.
--
-- public.users is the rich participant profile (company, title, bio, diet,
-- private_info...). Populating it is also what lets the People directory show
-- real signups instead of a hardcoded roster.
-- ============================================================================

-- ── 1. Signup trigger now creates BOTH the auth profile and the participant row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email in ('peter@outsome.co', 'alice.yoo@outsome.co', 'bernice@outsome.co', 'seo@outsome.co')
        then 'organizer'
      else 'participant'
    end
  )
  on conflict (id) do nothing;

  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    case
      when new.email in ('peter@outsome.co', 'alice.yoo@outsome.co', 'bernice@outsome.co', 'seo@outsome.co')
        then 'organizer'
      else 'participant'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- ── 2. Backfill the four existing accounts that predate the trigger change
insert into public.users (id, email, display_name, role)
select
  a.id,
  a.email,
  coalesce(nullif(a.raw_user_meta_data->>'display_name', ''), split_part(a.email, '@', 1)),
  coalesce(p.role, 'participant')
from auth.users a
left join public.profiles p on p.id = a.id
on conflict (id) do nothing;

-- ── 3. RLS on public.users: the directory is visible to everyone signed in,
--       but you may only edit your own row.
alter table public.users enable row level security;

drop policy if exists "users_select_authenticated" on public.users;
create policy "users_select_authenticated"
  on public.users for select to authenticated using (true);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users for insert to authenticated with check (auth.uid() = id);
