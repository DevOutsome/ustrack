import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * Access control for the portal.
 *
 * Anyone can request a login code, but a new account is `approved = false` until
 * an organiser admits it in Admin > All Users. Until then the account must not
 * reach the schedule, the roster, the accommodation details or the RSVP data.
 *
 * Every data API goes through requireApproved(). /api/profile deliberately does
 * not, so someone waiting can still fill in their name.
 */

export type Access = {
  userId: string
  email: string
  role: string
  approved: boolean
}

export async function getAccess(): Promise<Access | null> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: role }, { data: approved }] = await Promise.all([
    supabase.rpc('get_user_role', { user_id: user.id }),
    supabase.rpc('is_approved', { user_id: user.id }),
  ])

  return {
    userId: user.id,
    email: user.email ?? '',
    role: role || 'participant',
    approved: approved === true,
  }
}

/**
 * Returns an error response when the caller may not read program data, or null
 * when the request should proceed.
 */
export async function requireApproved(): Promise<NextResponse | null> {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!access.approved) {
    return NextResponse.json(
      { error: 'Your account is waiting for approval', pending: true },
      { status: 403 }
    )
  }
  return null
}
