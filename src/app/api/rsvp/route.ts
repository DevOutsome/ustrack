import { createServerSupabase } from '@/lib/supabase-server'
import { requireApproved } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'

/**
 * RSVP persistence.
 *
 * Until 2026-09-11 RSVP state lived only in the browser's localStorage, so a
 * participant's taps never reached the server and the admin meal dashboard had
 * to invent headcounts. This route is the single place RSVP state is read and
 * written.
 *
 * Events are identified by a content-stable `event_key` (day|start|title-slug)
 * derived from the synced schedule - see the 20260911_rsvp_persistence migration.
 */

type RsvpRow = {
  user_id: string
  event_key: string
  status: string | null
  added_to_schedule: boolean | null
  // PostgREST types an embedded relation as an array even for a to-one FK.
  users: { display_name: string | null; email: string | null; company: string | null }[] | null
}

type Person = { id: string; name: string; company: string }

// The UI speaks 'yes'/'no'; the table has
// CHECK (status IN ('attending','not_attending')). Translate at this boundary
// so neither side has to adopt the other's vocabulary.
const TO_DB: Record<string, string> = { yes: 'attending', no: 'not_attending' }
const FROM_DB: Record<string, string> = { attending: 'yes', not_attending: 'no' }

/**
 * GET /api/rsvp
 * Returns the signed-in user's own RSVPs plus per-event aggregates used for
 * "who's going" and the admin meal dashboard.
 */
export async function GET() {
  const denied = await requireApproved()
  if (denied) return denied

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Embed the participant row so the schedule can show real names on
  // "who's going" instead of a generated roster.
  const { data, error } = await supabase
    .from('rsvps')
    .select('user_id, event_key, status, added_to_schedule, users(display_name, email, company)')
    .not('event_key', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as RsvpRow[]

  // The current user's own state, in the shape app.html keeps in memory.
  const mine: Record<string, boolean> = {}
  const myMeals: Record<string, string> = {}
  // Per-event aggregates for everyone.
  const counts: Record<string, { going: number; yes: number; no: number; people: Person[]; yesPeople: Person[]; noPeople: Person[] }> = {}

  const nameOf = (r: RsvpRow): Person => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return {
      id: r.user_id,
      name: u?.display_name || (u?.email ?? '').split('@')[0] || 'Guest',
      company: u?.company || '',
    }
  }

  for (const r of rows) {
    const key = r.event_key
    counts[key] ??= { going: 0, yes: 0, no: 0, people: [], yesPeople: [], noPeople: [] }
    if (r.added_to_schedule) {
      counts[key].going++
      counts[key].people.push(nameOf(r))
    }
    if (r.status === 'attending') counts[key].yesPeople.push(nameOf(r))
    if (r.status === 'not_attending') counts[key].noPeople.push(nameOf(r))
    if (r.status === 'attending') counts[key].yes++
    if (r.status === 'not_attending') counts[key].no++

    if (r.user_id === user.id) {
      if (r.added_to_schedule) mine[key] = true
      if (r.status && FROM_DB[r.status]) myMeals[key] = FROM_DB[r.status]
    }
  }

  // The caller's own display name, so an optimistic toggle can show it in the
  // attendee list before the next reload.
  const { data: me } = await supabase
    .from('users')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle()
  const userName = me?.display_name || (me?.email ?? user.email ?? '').split('@')[0] || 'You'

  return NextResponse.json({ userId: user.id, userName, mine, myMeals, counts })
}

/**
 * PUT /api/rsvp
 * Body: { eventKey, status?: 'yes'|'no'|null, addedToSchedule?: boolean }
 * Upserts the caller's own row. RLS guarantees a user can only write their own.
 */
export async function PUT(request: NextRequest) {
  const denied = await requireApproved()
  if (denied) return denied

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { eventKey?: string; status?: string | null; addedToSchedule?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventKey = (body.eventKey ?? '').trim()
  if (!eventKey || eventKey.length > 200) {
    return NextResponse.json({ error: 'eventKey required' }, { status: 400 })
  }
  const status = body.status && TO_DB[body.status] ? TO_DB[body.status] : null
  const addedToSchedule = body.addedToSchedule === true

  // Nothing selected on either axis means the row carries no information.
  if (!status && !addedToSchedule) {
    const { error } = await supabase
      .from('rsvps')
      .delete()
      .eq('user_id', user.id)
      .eq('event_key', eventKey)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cleared: true })
  }

  const { error } = await supabase
    .from('rsvps')
    .upsert(
      { user_id: user.id, event_key: eventKey, status, added_to_schedule: addedToSchedule },
      { onConflict: 'user_id,event_key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
