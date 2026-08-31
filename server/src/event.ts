// Event details come from environment variables (the same ones injected into the
// frontend at container start). This module turns them into a calendar invite so
// guests can add the party to their own calendar.

import type { Db, EventRow } from './db.ts';

export interface EventConfig {
  person: string;
  age: string;
  date: string;
  time: string;
  town: string;
  location: string;
  dressCode?: string;
  rsvpDeadline?: string;
}

export function eventConfig(env: NodeJS.ProcessEnv = process.env): EventConfig {
  return {
    person: env.BIRTHDAY_PERSON || '',
    age: env.BIRTHDAY_AGE || '',
    date: env.EVENT_DATE || '',      // YYYY-MM-DD
    time: env.EVENT_TIME || '',      // free text, e.g. "15h00 - 17h00"
    town: env.EVENT_TOWN || '',
    location: env.EVENT_LOCATION || '',
    dressCode: env.DRESS_CODE || '',
    rsvpDeadline: env.EVENT_RSVP_DEADLINE || ''  // YYYY-MM-DD, optional
  };
}

// Turn arbitrary text (usually the celebrated person's name) into a URL-safe
// slug: lowercase, diacritics stripped, non-alphanumerics collapsed to dashes.
// Falls back to 'event' when the result would be empty or purely numeric.
export function slugify(input: string): string {
  const base = String(input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  if (!base || /^[0-9]+$/.test(base)) return 'event';
  return base;
}

// Map a stored event row onto the EventConfig shape the ics/deadline helpers use.
export function eventConfigFromRow(row: EventRow): EventConfig {
  return {
    person: row.person,
    age: row.age,
    date: row.date,
    time: row.time,
    town: row.town,
    location: row.location,
    dressCode: row.dress_code,
    rsvpDeadline: row.rsvp_deadline
  };
}

// The default event backs the legacy single-event routes. Prefer the flagged
// row; fall back to the lowest id if (somehow) none is flagged.
export function getDefaultEvent(db: Db): EventRow {
  const row =
    db.get<EventRow>('SELECT * FROM event WHERE is_default = 1 ORDER BY id LIMIT 1') ??
    db.get<EventRow>('SELECT * FROM event ORDER BY id LIMIT 1');
  if (!row) {
    // Should never happen once initSchema has run, but stay defensive.
    db.run("INSERT OR IGNORE INTO event (slug, is_default) VALUES ('default', 1)");
    db.run("UPDATE event SET is_default = 1 WHERE slug = 'default'");
    return db.get<EventRow>('SELECT * FROM event WHERE is_default = 1 ORDER BY id LIMIT 1') as EventRow;
  }
  return row;
}

export function getEventBySlug(db: Db, slug: string): EventRow | undefined {
  return db.get<EventRow>('SELECT * FROM event WHERE slug = ?', [slug]);
}

export function getEventById(db: Db, id: number): EventRow | undefined {
  return db.get<EventRow>('SELECT * FROM event WHERE id = ?', [id]);
}

// Seed/repair the default event from the env config so existing single-event
// deployments flow their configuration into the default row on first boot.
// Once an admin edits the event (person becomes non-empty) boot never clobbers it.
export function ensureDefaultEvent(db: Db, cfg: EventConfig): EventRow {
  const row = getDefaultEvent(db);
  if (!row.person && cfg.person) {
    // Migrate any legacy global theme stored in the settings table.
    const themeRow = db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['theme']);
    const theme = themeRow?.value || row.theme;
    db.run(
      `UPDATE event
       SET person = ?, age = ?, date = ?, time = ?, town = ?, location = ?,
           dress_code = ?, rsvp_deadline = ?, theme = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        cfg.person,
        cfg.age || '',
        cfg.date || '',
        cfg.time || '',
        cfg.town || '',
        cfg.location || '',
        cfg.dressCode || '',
        cfg.rsvpDeadline || '',
        theme,
        row.id
      ]
    );
    return getEventById(db, row.id) as EventRow;
  }
  return row;
}

// True when an RSVP deadline is configured and has passed (end of that day).
export function isRsvpClosed(cfg: EventConfig, now: Date = new Date()): boolean {
  if (!cfg.rsvpDeadline || !/^\d{4}-\d{2}-\d{2}$/.test(cfg.rsvpDeadline)) return false;
  const deadline = new Date(`${cfg.rsvpDeadline}T23:59:59`);
  return now.getTime() > deadline.getTime();
}

// Pull up to two "HHhMM" / "HH:MM" / "HHh" times out of free-form text.
// Returns { start, end } as 'HHMMSS', or null when nothing parses.
function parseTimeRange(time: string): { start: string; end: string } | null {
  const matches = [...String(time).matchAll(/(\d{1,2})\s*[h:]\s*(\d{0,2})/g)];
  if (matches.length === 0) return null;

  const toHms = (m: RegExpMatchArray): string => {
    const h = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
    const min = String(m[2] ? Math.min(59, parseInt(m[2], 10)) : 0).padStart(2, '0');
    return `${h}${min}00`;
  };

  const start = toHms(matches[0]);
  // Default to a two-hour party when only a start time is given.
  const end = matches[1]
    ? toHms(matches[1])
    : `${String((parseInt(start.slice(0, 2), 10) + 2) % 24).padStart(2, '0')}${start.slice(2)}`;

  return { start, end };
}

// Escape a value for an iCalendar text field (RFC 5545 §3.3.11).
function escapeIcsText(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Build an iCalendar (.ics) document from the event config.
 * Returns the document string, or null when there is no usable event date.
 */
export function buildIcs(cfg: EventConfig, now: Date = new Date()): string | null {
  const compactDate = String(cfg.date).replace(/-/g, '');
  if (!/^\d{8}$/.test(compactDate)) return null;

  const times = parseTimeRange(cfg.time);
  let dtStart: string;
  let dtEnd: string;
  if (times) {
    // Floating local time — calendars show it in the reader's own zone, which
    // is the right behaviour for a local party without a stored timezone.
    dtStart = `DTSTART:${compactDate}T${times.start}`;
    dtEnd = `DTEND:${compactDate}T${times.end}`;
  } else {
    // All-day event spanning the single date.
    const next = new Date(`${cfg.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const endDate = formatStamp(next).slice(0, 8);
    dtStart = `DTSTART;VALUE=DATE:${compactDate}`;
    dtEnd = `DTEND;VALUE=DATE:${endDate}`;
  }

  const title = cfg.age
    ? `Anniversaire de ${cfg.person} (${cfg.age} ans)`
    : `Anniversaire de ${cfg.person}`;
  const uid = `${compactDate}-${cfg.person || 'event'}@birthday-invitation`.replace(/\s+/g, '-');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//birthday-invitation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatStamp(now)}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcsText(title)}`
  ];
  if (cfg.location) lines.push(`LOCATION:${escapeIcsText(cfg.location)}`);
  if (cfg.time) lines.push(`DESCRIPTION:${escapeIcsText(cfg.time)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n') + '\r\n';
}
