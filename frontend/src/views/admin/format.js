import { getTheme } from '../../themes.js';

export const themeIcon = (id) => getTheme(id).icon;
export const themeLabel = (id) => getTheme(id).label;

export function eventUrl(ev) {
  if (!ev) return `${window.location.origin}/`;
  return ev.is_default ? `${window.location.origin}/` : `${window.location.origin}/e/${ev.slug}`;
}

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

export function formatEventDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function slugForFile(person) {
  return (person || 'invitation')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
