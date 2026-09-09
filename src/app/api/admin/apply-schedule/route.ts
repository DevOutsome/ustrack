import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/apply-schedule
 *
 * Body (JSON):
 *   { schedule: ScheduleDay[], sourceUrl?: string, sourceType: string }
 *
 * Upserts the schedule into schedule_data (id = 'current').
 * Organizer-only.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Role check via SECURITY DEFINER RPC (same pattern as /api/admin/members)
    const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id });
    if (role !== 'organizer') {
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.schedule || !Array.isArray(body.schedule) || !body.schedule.length) {
      return NextResponse.json({ error: 'No schedule data provided' }, { status: 400 });
    }

    const { error } = await supabase.from('schedule_data').upsert({
      id: 'current',
      schedule: body.schedule,
      source_url: body.sourceUrl ?? null,
      source_type: body.sourceType ?? 'manual',
      synced_at: new Date().toISOString(),
      synced_by: user.email ?? user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      syncedBy: user.email,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
