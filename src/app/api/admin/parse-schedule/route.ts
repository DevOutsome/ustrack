import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { parseScheduleCSV, parseScheduleText, sheetsUrlToCSV } from '@/lib/schedule-parser';

/**
 * POST /api/admin/parse-schedule
 *
 * Body (JSON):
 *   { sheetUrl: string }   – parse a Google Sheets URL
 *   { text: string }       – parse raw schedule text (from PDF extraction etc.)
 *
 * Returns: { schedule: ScheduleDay[], dayCount, eventCount, sourceType }
 *
 * Organizer-only.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Role check via users table
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'organizer') {
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const body = await req.json();

    // ── Google Sheets URL ──────────────────────────────
    if (body.sheetUrl) {
      const parsed = sheetsUrlToCSV(body.sheetUrl);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid Google Sheets URL. Paste the full URL from the browser.' },
          { status: 400 },
        );
      }

      // Fetch CSV export
      const csvRes = await fetch(parsed.csvUrl, {
        headers: { 'Accept': 'text/csv' },
      });

      if (!csvRes.ok) {
        return NextResponse.json(
          { error: `Could not fetch sheet (HTTP ${csvRes.status}). Make sure the sheet is shared as "Anyone with the link".` },
          { status: 400 },
        );
      }

      const csvText = await csvRes.text();
      const schedule = parseScheduleCSV(csvText);

      if (!schedule.length) {
        return NextResponse.json(
          { error: 'No schedule data found in the sheet. Check the date format (e.g. 10/19(월)) and column layout.' },
          { status: 400 },
        );
      }

      const eventCount = schedule.reduce((sum, d) => sum + d.events.length, 0);

      return NextResponse.json({
        schedule,
        dayCount: schedule.length,
        eventCount,
        sourceType: 'google_sheets',
        sourceUrl: body.sheetUrl,
      });
    }

    // ── Plain text (from PDF or manual paste) ──────────
    if (body.text) {
      const schedule = body.text.includes(',')
        ? parseScheduleCSV(body.text)
        : parseScheduleText(body.text);

      if (!schedule.length) {
        return NextResponse.json(
          { error: 'Could not parse schedule from the provided text.' },
          { status: 400 },
        );
      }

      const eventCount = schedule.reduce((sum, d) => sum + d.events.length, 0);

      return NextResponse.json({
        schedule,
        dayCount: schedule.length,
        eventCount,
        sourceType: body.sourceType || 'pdf',
        sourceUrl: body.sourceUrl || null,
      });
    }

    return NextResponse.json({ error: 'Provide sheetUrl or text' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
