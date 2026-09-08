import { createServerSupabase } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET: list all members (organizers only)
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id })
  if (role !== 'organizer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: members } = await supabase
    .rpc('get_all_members')
  return NextResponse.json(members || [])
}

// PUT: update a member's role (organizers only)
export async function PUT(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id })
  if (role !== 'organizer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, newRole } = await request.json()
  if (!email || !['organizer', 'participant', 'speaker', 'vc'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('set_user_role', { target_email: email, new_role: newRole })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
