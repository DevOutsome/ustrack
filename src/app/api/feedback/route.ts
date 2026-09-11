import { createServerSupabase } from '@/lib/supabase-server'
import { requireApproved } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Daily NPS + issue reports.
 *
 * Both used to be written to localStorage, so a participant's issue report never
 * left their own browser and the admin panel only ever showed the organiser's
 * own entries (attributed to a hardcoded "Peter Shin").
 *
 * RLS does the access control: everyone reads their own rows, organisers read
 * all of them (via the SECURITY DEFINER get_user_role lookup).
 */

// issues.status CHECK allows 'open' | 'resolved' | 'dismissed'
// nps_responses.rating CHECK allows 1..5
const ISSUE_STATUSES = ['open', 'resolved', 'dismissed']

type Named = { display_name: string | null; email: string | null }
const personName = (u: Named[] | Named | null | undefined): string => {
  const x = Array.isArray(u) ? u[0] : u
  return x?.display_name || (x?.email ?? '').split('@')[0] || 'Someone'
}

export async function GET() {
  const denied = await requireApproved()
  if (denied) return denied

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [npsRes, issuesRes] = await Promise.all([
    supabase
      .from('nps_responses')
      .select('user_id, day, rating, highlight, created_at, users(display_name, email)')
      .order('day', { ascending: true }),
    supabase
      .from('issues')
      .select('id, user_id, day, category, description, status, created_at, users(display_name, email)')
      .order('created_at', { ascending: false }),
  ])

  if (npsRes.error) return NextResponse.json({ error: npsRes.error.message }, { status: 500 })
  if (issuesRes.error) return NextResponse.json({ error: issuesRes.error.message }, { status: 500 })

  // Days this user has already checked in for, so the form can show the
  // "thanks" state instead of asking twice.
  const myDays: Record<number, { rating: number | null; highlight: string | null }> = {}
  for (const r of npsRes.data ?? []) {
    if (r.user_id === user.id) myDays[r.day] = { rating: r.rating, highlight: r.highlight }
  }

  return NextResponse.json({
    myDays,
    nps: (npsRes.data ?? []).map(r => ({
      day: r.day, rating: r.rating, highlight: r.highlight,
      from: personName(r.users), createdAt: r.created_at,
    })),
    issues: (issuesRes.data ?? []).map(r => ({
      id: r.id, day: r.day, cat: r.category, text: r.description,
      status: r.status, from: personName(r.users), createdAt: r.created_at,
    })),
  })
}

/**
 * POST /api/feedback
 * Body: { day, rating?, highlight?, issue?: { category, text } }
 * The daily check-in is upserted (one per person per day); each issue report is
 * a new row so nothing overwrites a previous report.
 */
export async function POST(request: NextRequest) {
  const denied = await requireApproved()
  if (denied) return denied

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { day?: number; rating?: number; highlight?: string; issue?: { category?: string; text?: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const day = Number(body.day)
  if (!Number.isInteger(day) || day < 1 || day > 60) {
    return NextResponse.json({ error: 'Valid day required' }, { status: 400 })
  }

  const result: { nps?: boolean; issue?: boolean } = {}

  if (body.rating != null || body.highlight != null) {
    const rating = Number(body.rating)
    if (body.rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    }
    const { error } = await supabase.from('nps_responses').upsert(
      {
        user_id: user.id,
        day,
        rating: body.rating != null ? rating : null,
        highlight: (body.highlight ?? '').trim().slice(0, 400) || null,
      },
      { onConflict: 'user_id,day' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result.nps = true
  }

  const issueText = (body.issue?.text ?? '').trim()
  if (issueText) {
    const { error } = await supabase.from('issues').insert({
      user_id: user.id,
      day,
      category: (body.issue?.category ?? 'Other').trim().slice(0, 40),
      description: issueText.slice(0, 1000),
      status: ISSUE_STATUSES[0],
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result.issue = true
  }

  if (!result.nps && !result.issue) {
    return NextResponse.json({ error: 'Nothing to submit' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, ...result })
}
