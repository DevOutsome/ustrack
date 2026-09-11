import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * GET /api/people
 *
 * The participant roster, from public.users (populated by the signup trigger).
 * Before 2026-09-11 the People tab and the admin "no reply" list were driven by
 * a hardcoded 19-person array that included placeholder rows like
 * "Participant A-1", so neither reflected who had actually signed up.
 */
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, company, title, role, diet, avatar_url, bio')
    .order('display_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const people = (data ?? []).map(u => ({
    id: u.id,
    name: u.display_name || (u.email ?? '').split('@')[0] || 'Guest',
    email: u.email,
    co: u.company || '',
    title: u.title || '',
    role: u.role || 'participant',
    diet: u.diet || '',
    avatar: u.avatar_url || '',
    bio: u.bio || '',
  }))

  return NextResponse.json({ people })
}
