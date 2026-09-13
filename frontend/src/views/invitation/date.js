/**
 * Parse a stored 'YYYY-MM-DD' event date into a Date anchored at *local* noon.
 *
 * `new Date('2025-09-06')` is midnight UTC, and every reader below formats in
 * the viewer's own zone — so anyone west of UTC saw the party advertised a day
 * early, and the countdown's "c'est aujourd'hui" flipped on the wrong date.
 * Noon local keeps the day that was typed intact in every timezone, which is
 * what the server already does when it renders the same date into the shell
 * (see server/src/seo.ts).
 */
export function parseEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The party's date, spelled out in French. Empty when there isn't one. */
export function formatDate(date) {
  const d = parseEventDate(date);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** The RSVP deadline, as the invitation states it. Empty when unset/invalid. */
export function formatDeadline(deadline) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || '')) return '';
  return new Date(`${deadline}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}
