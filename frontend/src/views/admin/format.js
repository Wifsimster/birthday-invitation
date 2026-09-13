// Presentation helpers shared by the console's panels.

import { getTheme } from '../../themes.js';

export const themeIcon = (id) => getTheme(id).icon;
export const themeLabel = (id) => getTheme(id).label;

/** The public address of an invitation; the default event lives at the root. */
export function eventUrl(ev) {
  if (!ev) return `${window.location.origin}/`;
  return ev.is_default ? `${window.location.origin}/` : `${window.location.origin}/e/${ev.slug}`;
}

/** A stored timestamp, spelled out in French. Empty when unparseable. */
export function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** An event's own date (no time). Falls back to the raw value when odd. */
export function formatEventDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** A filename-safe version of the event's name, for the QR download. */
export function slugForFile(person) {
  return (person || 'invitation')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
