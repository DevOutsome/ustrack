import { createServerSupabase } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET/PUT /api/profile
 *
 * Each participant fills in their own row in public.users. Before this existed
 * the Profile tab was static markup showing one person's real name, phone and
 * Korean name to everyone who signed in.
 *
 * RLS ("users_update_own") means a caller can only ever write their own row;
 * role is deliberately NOT writable here.
 */

const FIELD_LIMITS: Record<string, number> = {
  display_name: 80,
  company: 80,
  title: 80,
  location: 80,
  diet: 200,
  bio: 400,
}

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, company, title, location, bio, diet, social_links, role, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const emailPrefix = (data?.email ?? '').split('@')[0]
  return NextResponse.json({
    profile: data,
    // True while the row still holds the auto-generated placeholder name, which
    // is how the UI knows to nudge someone to introduce themselves.
    needsSetup: !data?.display_name || data.display_name === emailPrefix,
  })
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    if (!(field in body)) continue
    const raw = body[field]
    if (raw === null) { patch[field] = null; continue }
    if (typeof raw !== 'string') continue
    patch[field] = raw.trim().slice(0, max) || null
  }

  if (typeof body.linkedin === 'string') {
    const url = body.linkedin.trim().slice(0, 200)
    patch.social_links = url ? { linkedin: url } : null
  }

  if (!('display_name' in patch) && !Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  if ('display_name' in patch && !patch.display_name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', user.id)
    .select('id, email, display_name, company, title, location, bio, diet, social_links, role, avatar_url')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data })
}
