import { createServerSupabase } from '@/lib/supabase-server'
import { getAccess } from '@/lib/access'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/admin/reset-test-data
 *
 * Clears rsvps, nps_responses and issues. Users, schedule and announcements stay.
 *
 * This goes through the reset_program_data() SECURITY DEFINER function, not
 * through table deletes. RLS only lets someone delete their own rsvps, and has
 * no delete policy at all for nps_responses or issues - so the direct version
 * deleted almost nothing while reporting a SELECT count as if it had. The
 * function returns the real deleted row counts.
 */
export async function DELETE() {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role !== 'organizer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.rpc('reset_program_data')

  if (error) {
    // Never report success for a reset that did not run.
    return NextResponse.json(
      { error: `Reset failed: ${error.message}` },
      { status: 500 },
    )
  }

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    cleared: {
      rsvps: Number(row?.rsvps ?? 0),
      nps_responses: Number(row?.nps_responses ?? 0),
      issues: Number(row?.issues ?? 0),
    },
  })
}
