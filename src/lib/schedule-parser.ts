/**
 * Schedule Parser for Outsome US Track
 * Parses Google Sheets CSV export into the app.html var S format.
 *
 * Supports two spreadsheet layouts:
 *  1. "Existing" Healthcare Track format (date in col C, time in col D, category col E, title col F, ...)
 *  2. "Template" format (Date | Day Title | Time | Category | Title | Location | Description | Context | Is Meal?)
 */

// ── CSV parser (handles quoted fields with embedded newlines) ──────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Split CSV text into logical rows, handling quoted fields that span multiple lines.
 */
function splitCSVRows(csvText: string): string[] {
  const rawLines = csvText.split('\n');
  const rows: string[] = [];
  let currentRow = '';

  for (const line of rawLines) {
    if (currentRow) {
      currentRow += '\n' + line;
    } else {
      currentRow = line;
    }
    // Count unescaped quotes – if odd, the row spans into the next line
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      rows.push(currentRow);
      currentRow = '';
    }
  }
  if (currentRow) rows.push(currentRow);
  return rows;
}

// ── Category normalisation ────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  meal: 'meal',
  lecture: 'lecture',
  workshop: 'workshop',
  fireside: 'fireside',
  event: 'event',
  'office hours': 'office_hours',
  meeting: 'meeting',
  exercise: 'exercise',
  move: 'move',
  free: 'free',
  'free time': 'free',
  'group activity': 'group_activity',
  'house activity': 'house_activity',
  orientation: 'orientation',
};

function normaliseCat(raw: string): string {
  const key = raw.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? 'event';
}

// ── Day-of-week helpers ───────────────────────────────────────────────────

const DOW_KR: Record<string, string> = {
  월: 'Mon', 화: 'Tue', 수: 'Wed', 목: 'Thu', 금: 'Fri', 토: 'Sat', 일: 'Sun',
};

function dowFromDate(month: number, day: number, year = 2026): string {
  const d = new Date(year, month - 1, day);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

// ── Types (matching var S in app.html) ────────────────────────────────────

export interface ScheduleEvent {
  t: string;       // "HH:MM–HH:MM"
  cat: string;     // normalised category key
  title: string;
  loc: string;
  meal?: number;   // 1 if meal event
  desc?: string;   // description / expected outcomes
  ctx?: string;    // context / speaker info
}

export interface ScheduleDay {
  day: number;
  date: string;    // "10/19"
  dow: string;     // "Mon"
  theme: string;   // day title
  off?: number;    // 1 if off day
  events: ScheduleEvent[];
}

// ── Detect layout ─────────────────────────────────────────────────────────

type Layout = 'existing' | 'template';

function detectLayout(rows: string[][]): Layout {
  // Template format has recognisable header keywords in first ~10 rows
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].map(c => c.toLowerCase().trim()).join('|');
    if (joined.includes('day title') && joined.includes('category')) return 'template';
  }
  return 'existing';
}

// ── Parse "existing" Healthcare Track format ──────────────────────────────

function parseExisting(rows: string[][]): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  let current: ScheduleDay | null = null;

  for (const cols of rows) {
    // Day header: Column C (idx 2) has "10/19(월)" pattern
    const dateStr = (cols[2] ?? '').trim();
    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\(([월화수목금토일])\)/);

    if (dateMatch) {
      const [, m, d, dowKr] = dateMatch;
      const dayTitle = (cols[3] ?? '').replace(/^DAY\s*\d+\s*[:：]\s*/i, '').trim();
      current = {
        day: days.length + 1,
        date: `${m}/${d}`,
        dow: DOW_KR[dowKr] ?? dowKr,
        theme: dayTitle,
        events: [],
      };
      // Mark off/free days
      if (/^(off|free\s*day|rest)/i.test(dayTitle)) current.off = 1;
      days.push(current);
      continue;
    }

    // Event row: Column D (idx 3) has time "HH:MM - HH:MM"
    const timeStr = (cols[3] ?? '').trim();
    const timeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);

    if (timeMatch && current) {
      const [, start, end] = timeMatch;
      const rawCat = (cols[4] ?? '').trim();
      const rawTitle = (cols[5] ?? '').trim();
      const rawLoc = (cols[6] ?? '').trim();
      const rawCtx = (cols[7] ?? '').trim();
      const rawOut = (cols[8] ?? '').trim();

      if (!rawTitle && !rawCat) continue; // skip empty rows

      const cat = normaliseCat(rawCat);
      const cleanTitle = cleanText(rawTitle) || cleanText(rawCat);
      const ev: ScheduleEvent = {
        t: `${start}–${end}`,
        cat,
        title: cleanTitle,
        loc: cleanLocation(rawLoc),
      };

      if (cat === 'meal' || /meal/i.test(rawCat)) ev.meal = 1;
      // Detect meals from title when category is not 'Meal'
      if (/\b(breakfast|lunch|dinner)\b/i.test(cleanTitle) && !ev.meal) ev.meal = 1;
      if (rawCtx) ev.ctx = cleanText(rawCtx).slice(0, 500);
      if (rawOut) ev.desc = cleanText(rawOut).slice(0, 500);

      current.events.push(ev);
    }
  }

  return days;
}

// ── Parse "template" format ───────────────────────────────────────────────

function parseTemplate(rows: string[][]): ScheduleDay[] {
  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = rows[i].map(c => c.toLowerCase().trim()).join('|');
    if (joined.includes('date') && joined.includes('category') && joined.includes('title')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const header = rows[headerIdx].map(c => c.toLowerCase().trim());
  const idx = {
    date: header.indexOf('date'),
    dayTitle: header.findIndex(h => h.includes('day title') || h.includes('day theme')),
    time: header.indexOf('time'),
    category: header.indexOf('category'),
    title: header.indexOf('title'),
    location: header.findIndex(h => h === 'location' || h === 'loc'),
    desc: header.findIndex(h => h.includes('description') || h === 'desc'),
    ctx: header.findIndex(h => h.includes('context') || h.includes('speaker')),
    isMeal: header.findIndex(h => h.includes('meal')),
  };

  const days: ScheduleDay[] = [];
  let current: ScheduleDay | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = rows[i];
    const dateStr = (cols[idx.date] ?? '').trim();
    const dayTitleStr = idx.dayTitle >= 0 ? (cols[idx.dayTitle] ?? '').trim() : '';

    // New day if date column has a value
    if (dateStr) {
      const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\(([월화수목금토일])\))?/);
      if (dateMatch) {
        const [, m, d, dowKr] = dateMatch;
        current = {
          day: days.length + 1,
          date: `${m}/${d}`,
          dow: dowKr ? (DOW_KR[dowKr] ?? dowKr) : dowFromDate(+m, +d),
          theme: dayTitleStr.replace(/^DAY\s*\d+\s*[:：]\s*/i, '').trim(),
          events: [],
        };
        if (/^(off|free\s*day|rest)/i.test(current.theme)) current.off = 1;
        days.push(current);
      }
    }

    // Event data
    const timeStr = idx.time >= 0 ? (cols[idx.time] ?? '').trim() : '';
    const timeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);

    if (timeMatch && current) {
      const [, start, end] = timeMatch;
      const rawCat = idx.category >= 0 ? (cols[idx.category] ?? '').trim() : '';
      const rawTitle = idx.title >= 0 ? (cols[idx.title] ?? '').trim() : '';
      const rawLoc = idx.location >= 0 ? (cols[idx.location] ?? '').trim() : '';
      const rawDesc = idx.desc >= 0 ? (cols[idx.desc] ?? '').trim() : '';
      const rawCtx = idx.ctx >= 0 ? (cols[idx.ctx] ?? '').trim() : '';
      const rawMeal = idx.isMeal >= 0 ? (cols[idx.isMeal] ?? '').trim().toUpperCase() : '';

      if (!rawTitle && !rawCat) continue;

      const cat = normaliseCat(rawCat);
      const ev: ScheduleEvent = {
        t: `${start}–${end}`,
        cat,
        title: rawTitle || rawCat,
        loc: cleanLocation(rawLoc),
      };

      if (cat === 'meal' || rawMeal === 'TRUE' || rawMeal === '1') ev.meal = 1;
      if (rawCtx) ev.ctx = rawCtx.slice(0, 500);
      if (rawDesc) ev.desc = rawDesc.slice(0, 500);

      current.events.push(ev);
    }
  }

  return days;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function cleanLocation(loc: string): string {
  return loc
    .replace(/1417 Sanchez Ave,?\s*Burlingame,?\s*CA\s*94010/gi, 'MARU SF')
    .trim();
}

/** Collapse excessive whitespace / newlines in a string. */
function cleanText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n/g, ' · ')
    .trim();
}

// ── Public API ────────────────────────────────────────────────────────────

export function parseScheduleCSV(csvText: string): ScheduleDay[] {
  const rows = splitCSVRows(csvText).map(parseCSVLine);
  const layout = detectLayout(rows);
  const days = layout === 'template' ? parseTemplate(rows) : parseExisting(rows);
  return days;
}

/**
 * Extract a Google Sheets CSV export URL from an editor URL.
 * Returns { spreadsheetId, gid, csvUrl } or null.
 */
export function sheetsUrlToCSV(url: string): { spreadsheetId: string; gid: string; csvUrl: string } | null {
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;
  const spreadsheetId = idMatch[1];
  // Try to extract gid from #gid= or ?gid=
  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  return { spreadsheetId, gid, csvUrl };
}

/**
 * Parse schedule text extracted from a PDF (best-effort).
 * Looks for date + time patterns and tries to build the same structure.
 */
export function parseScheduleText(text: string): ScheduleDay[] {
  const lines = text.split('\n');
  const days: ScheduleDay[] = [];
  let current: ScheduleDay | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Look for day header patterns: "10/29(목)" or "Oct 29" or "DAY 11"
    const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\(([월화수목금토일])\)/);
    if (dateMatch) {
      const [, m, d, dowKr] = dateMatch;
      // Try to find a day title after the date
      const rest = trimmed.slice(dateMatch.index! + dateMatch[0].length).trim();
      const theme = rest.replace(/^DAY\s*\d+\s*[:：]\s*/i, '').trim();
      current = {
        day: days.length + 1,
        date: `${m}/${d}`,
        dow: DOW_KR[dowKr] ?? dowKr,
        theme: theme || `Day ${days.length + 1}`,
        events: [],
      };
      if (/^(off|free\s*day|rest)/i.test(theme)) current.off = 1;
      days.push(current);
      continue;
    }

    // Look for event lines: "HH:MM - HH:MM  Category  Title"
    const timeMatch = trimmed.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (timeMatch && current) {
      const [fullMatch, start, end] = timeMatch;
      const afterTime = trimmed.slice(timeMatch.index! + fullMatch.length).trim();

      // Try to split remaining text into category + title
      const parts = afterTime.split(/\s{2,}|\t/);
      const rawCat = parts[0] ?? '';
      const rawTitle = parts.slice(1).join(' ').trim() || rawCat;

      const cat = normaliseCat(rawCat);
      const ev: ScheduleEvent = {
        t: `${start}–${end}`,
        cat,
        title: rawTitle || rawCat || 'TBD',
        loc: '',
      };
      if (cat === 'meal') ev.meal = 1;
      current.events.push(ev);
    }
  }

  return days;
}
