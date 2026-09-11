-- ============================================================================
-- RSVP persistence (2026-09-11)
--
-- Before this migration RSVP state lived only in each browser's localStorage,
-- so nothing a participant tapped ever reached the server and the admin meal
-- dashboard showed generated numbers instead of real ones.
--
-- Events are stored as a jsonb blob in public.schedule_data (the Google Sheet
-- is the source of truth), not as rows in public.events. A uuid event_id would
-- therefore change on every re-sync, so RSVPs key off a CONTENT-STABLE text key:
--
--     event_key = '<day>|<start time>|<slugified title>'
--     e.g.        '2|08:00|daily-sync-over-breakfast'
--
-- Re-syncing the sheet keeps RSVPs attached as long as the day, start time and
-- title are unchanged. If an event is genuinely renamed or rescheduled, its
-- RSVPs detach - which is the honest outcome, since it is a different session.
-- ============================================================================

alter table public.rsvps add column if not exists event_key text;
alter table public.rsvps alter column event_id drop not null;

-- status: 'yes' | 'no' | null  (meal RSVP)
-- added_to_schedule: whether the event is in the user's personal schedule
comment on column public.rsvps.event_key is
  'Content-stable event identifier: day|start|title-slug. Survives sheet re-sync.';

-- Exactly one row per user per event.
create unique index if not exists rsvps_user_event_key_idx
  on public.rsvps (user_id, event_key);

create index if not exists rsvps_event_key_idx on public.rsvps (event_key);

alter table public.rsvps enable row level security;

-- Drop the earlier hand-made policies so exactly one documented set governs this
-- table. "Own RSVPs" (ALL, public) and "Organizer sees all RSVPs" (SELECT via a
-- subquery on users) are both fully covered by the four policies below.
drop policy if exists "Own RSVPs" on public.rsvps;
drop policy if exists "Organizer sees all RSVPs" on public.rsvps;

-- Everyone signed in can read all RSVPs: the schedule shows "who's going" and
-- the admin dashboard needs headcounts. Writes are restricted to your own rows.
drop policy if exists "rsvps_select_authenticated" on public.rsvps;
create policy "rsvps_select_authenticated"
  on public.rsvps for select to authenticated using (true);

drop policy if exists "rsvps_insert_own" on public.rsvps;
create policy "rsvps_insert_own"
  on public.rsvps for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "rsvps_update_own" on public.rsvps;
create policy "rsvps_update_own"
  on public.rsvps for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "rsvps_delete_own" on public.rsvps;
create policy "rsvps_delete_own"
  on public.rsvps for delete to authenticated using (auth.uid() = user_id);

-- Keep updated_at honest so we can tell when someone last changed their mind.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists rsvps_touch_updated_at on public.rsvps;
create trigger rsvps_touch_updated_at
  before update on public.rsvps
  for each row execute function public.touch_updated_at();
