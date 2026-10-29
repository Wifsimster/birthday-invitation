import type { EventRow } from '../db.ts';

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
    date: env.EVENT_DATE || '',
    time: env.EVENT_TIME || '',
    town: env.EVENT_TOWN || '',
    location: env.EVENT_LOCATION || '',
    dressCode: env.DRESS_CODE || '',
    rsvpDeadline: env.EVENT_RSVP_DEADLINE || ''
  };
}

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

export function isRsvpClosed(cfg: EventConfig, now: Date = new Date()): boolean {
  if (!cfg.rsvpDeadline || !/^\d{4}-\d{2}-\d{2}$/.test(cfg.rsvpDeadline)) return false;
  const deadline = new Date(`${cfg.rsvpDeadline}T23:59:59`);
  return now.getTime() > deadline.getTime();
}

function parseTimeRange(time: string): { start: string; end: string; endsNextDay: boolean } | null {
  const matches = [...String(time).matchAll(/(\d{1,2})\s*[h:]\s*(\d{0,2})/g)];
  if (matches.length === 0) return null;

  const toHms = (m: RegExpMatchArray): string => {
    const h = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
    const min = String(m[2] ? Math.min(59, parseInt(m[2], 10)) : 0).padStart(2, '0');
    return `${h}${min}00`;
  };

  const start = toHms(matches[0]);
  const end = matches[1]
    ? toHms(matches[1])
    : `${String((parseInt(start.slice(0, 2), 10) + 2) % 24).padStart(2, '0')}${start.slice(2)}`;

  return { start, end, endsNextDay: end <= start };
}

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

export function buildIcs(cfg: EventConfig, now: Date = new Date()): string | null {
  const compactDate = String(cfg.date).replace(/-/g, '');
  if (!/^\d{8}$/.test(compactDate)) return null;

  const nextDay = (): string => {
    const next = new Date(`${cfg.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return formatStamp(next).slice(0, 8);
  };

  const times = parseTimeRange(cfg.time);
  let dtStart: string;
  let dtEnd: string;
  if (times) {
    dtStart = `DTSTART:${compactDate}T${times.start}`;
    dtEnd = `DTEND:${times.endsNextDay ? nextDay() : compactDate}T${times.end}`;
  } else {
    dtStart = `DTSTART;VALUE=DATE:${compactDate}`;
    dtEnd = `DTEND;VALUE=DATE:${nextDay()}`;
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
