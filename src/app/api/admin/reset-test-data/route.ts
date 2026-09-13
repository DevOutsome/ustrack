import { createServerSupabase } from '@/lib/supabase-server'
import { getAccess } from '@/lib/access'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/admin/reset-test-data
 *
 * Wipes rsvps, nps_responses, and issues. Organiser-only.
 * Users, profiles, schedule_data, and auth accounts are untouched.
 */
export async function DELETE() {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.role !== 'organizer')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabase()
  const counts: Record<string, number> = {}

  for (const table of ['rsvps', 'nps_responses', 'issues'] as const) {
    // count before delete so we can report what was cleared
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    counts[table] = count ?? 0

    // delete all rows — neq('id', '') always true for uuid PKs
    const { error } = await supabase.from(table).delete().neq('id', '')
    if (error)
      return NextResponse.json(
        { error: `Failed to clear ${table}: ${error.message}` },
        { status: 500 },
      )
  }

  return NextResponse.json({ cleared: counts })
}
