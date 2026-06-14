// Event details come from environment variables (the same ones injected into the
// frontend at container start). This module turns them into a calendar invite so
// guests can add the party to their own calendar.

export interface EventConfig {
  person: string;
  age: string;
  date: string;
  time: string;
  town: string;
  location: string;
}

export function eventConfig(env: NodeJS.ProcessEnv = process.env): EventConfig {
  return {
    person: env.BIRTHDAY_PERSON || '',
    age: env.BIRTHDAY_AGE || '',
    date: env.EVENT_DATE || '',      // YYYY-MM-DD
    time: env.EVENT_TIME || '',      // free text, e.g. "15h00 - 17h00"
    town: env.EVENT_TOWN || '',
    location: env.EVENT_LOCATION || ''
  };
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
