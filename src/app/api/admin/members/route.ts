import { createServerSupabase } from '@/lib/supabase-server'
import { getAccess } from '@/lib/access'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Organiser-only member management: approve new signups and change roles.
 *
 * Reads public.users (not profiles) because that is where approval and the
 * participant details live. Role lookups go through the SECURITY DEFINER RPC -
 * a direct policy subquery on profiles is what caused the recursion bug there.
 */

const ROLES = ['organizer', 'participant', 'speaker', 'vc']

export async function GET() {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role !== 'organizer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, company, role, approved, approved_at, created_at')
    .order('approved', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    (data ?? []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.display_name || (u.email ?? '').split('@')[0],
      company: u.company || '',
      role: u.role || 'participant',
      approved: u.approved === true,
      joinedAt: u.created_at,
    }))
  )
}

/**
 * PUT: { email, newRole }   -> change role
 *      { email, approved }  -> admit or revoke access
 *      { email, reject: true } -> delete a pending (unapproved) account entirely
 */
export async function PUT(request: NextRequest) {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role !== 'organizer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email : ''
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  if (body.reject === true) {
    const { error } = await supabase.rpc('reject_pending_user', { target_email: email })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (typeof body.approved === 'boolean') {
    // Do not let an organiser lock themselves out mid-program.
    if (email === access.email && body.approved === false) {
      return NextResponse.json({ error: 'You cannot revoke your own access' }, { status: 400 })
    }
    const { error } = await supabase.rpc('set_user_approved', {
      target_email: email,
      is_approved: body.approved,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (typeof body.newRole === 'string') {
    if (!ROLES.includes(body.newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    const { error } = await supabase.rpc('set_user_role', { target_email: email, new_role: body.newRole })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // public.users carries its own copy of the role for the roster and admin view.
    await supabase.from('users').update({ role: body.newRole }).eq('email', email)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
}
