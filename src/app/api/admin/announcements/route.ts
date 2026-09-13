import { createServerSupabase } from '@/lib/supabase-server'
import { getAccess, requireApproved } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/admin/announcements
 *
 * GET  — any approved user can read (the bell panel needs them).
 * POST — organiser-only: { title, body }
 * DELETE — organiser-only: { id }
 *
 * Table: public.announcements (id uuid PK, title text, body text,
 *        created_at timestamptz, created_by uuid FK users.id)
 * If the table doesn't exist yet it will 500 and the client falls back to
 * the hardcoded ANN array, so this is safe to ship before the migration runs.
 */

export async function GET() {
  const denied = await requireApproved()
  if (denied) return denied

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    (data ?? []).map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })),
  )
}

export async function POST(request: NextRequest) {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role !== 'organizer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { title?: string; body?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const title = (body.title ?? '').trim().slice(0, 120)
  const text = (body.body ?? '').trim().slice(0, 500)
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { error } = await supabase.from('announcements').insert({
    title,
    body: text,
    created_by: access.userId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role !== 'organizer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { error } = await supabase.from('announcements').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
