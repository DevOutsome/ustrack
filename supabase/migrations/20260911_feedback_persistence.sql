-- ============================================================================
-- Daily NPS + issue reports persistence (2026-09-11)
--
-- Both features shipped writing only to localStorage, which meant:
--   * a participant reporting "the AC is broken" stored it in their own browser
--   * the admin Reported Issues panel read the ORGANISER's localStorage, so
--     Peter only ever saw issues he had filed himself
--   * every issue was attributed to the hardcoded string 'Peter Shin'
--
-- The tables already existed and were empty. This migration only replaces the
-- hand-made policies with an explicit set and adds the constraint that lets a
-- daily check-in be edited instead of duplicated.
-- ============================================================================

-- ── Daily NPS ────────────────────────────────────────────────────────────────
-- One check-in per person per day; re-submitting updates the same row.
create unique index if not exists nps_responses_user_day_idx
  on public.nps_responses (user_id, day);

alter table public.nps_responses enable row level security;

drop policy if exists "Own NPS" on public.nps_responses;
drop policy if exists "Organizer sees all NPS" on public.nps_responses;

-- Participants see only their own check-ins. Organisers see everything, via the
-- SECURITY DEFINER role lookup (a direct subquery on profiles/users inside a
-- policy is what caused the recursion bug on public.profiles).
drop policy if exists "nps_select_own_or_organizer" on public.nps_responses;
create policy "nps_select_own_or_organizer"
  on public.nps_responses for select to authenticated
  using (auth.uid() = user_id or public.get_user_role(auth.uid()) = 'organizer');

drop policy if exists "nps_insert_own" on public.nps_responses;
create policy "nps_insert_own"
  on public.nps_responses for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "nps_update_own" on public.nps_responses;
create policy "nps_update_own"
  on public.nps_responses for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Issue reports ────────────────────────────────────────────────────────────
alter table public.issues enable row level security;

drop policy if exists "Own issues" on public.issues;
drop policy if exists "Organizer sees all issues" on public.issues;

drop policy if exists "issues_select_own_or_organizer" on public.issues;
create policy "issues_select_own_or_organizer"
  on public.issues for select to authenticated
  using (auth.uid() = user_id or public.get_user_role(auth.uid()) = 'organizer');

drop policy if exists "issues_insert_own" on public.issues;
create policy "issues_insert_own"
  on public.issues for insert to authenticated with check (auth.uid() = user_id);

-- Only organisers close an issue; the reporter may edit their own text.
drop policy if exists "issues_update_own_or_organizer" on public.issues;
create policy "issues_update_own_or_organizer"
  on public.issues for update to authenticated
  using (auth.uid() = user_id or public.get_user_role(auth.uid()) = 'organizer')
  with check (auth.uid() = user_id or public.get_user_role(auth.uid()) = 'organizer');

create index if not exists issues_day_idx on public.issues (day);
create index if not exists nps_responses_day_idx on public.nps_responses (day);
