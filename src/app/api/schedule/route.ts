import { createServerSupabase } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/schedule
 * Returns the current schedule from Supabase schedule_data table.
 * Falls back to null if no synced schedule exists (app.html uses hardcoded fallback).
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from('schedule_data')
      .select('schedule, synced_at, source_url, source_type, synced_by')
      .eq('id', 'current')
      .single();

    if (error || !data) {
      return NextResponse.json({ schedule: null });
    }

    return NextResponse.json({
      schedule: data.schedule,
      syncedAt: data.synced_at,
      sourceUrl: data.source_url,
      sourceType: data.source_type,
      syncedBy: data.synced_by,
    });
  } catch {
    return NextResponse.json({ schedule: null });
  }
}
