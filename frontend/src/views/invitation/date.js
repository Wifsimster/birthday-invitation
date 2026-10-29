export function parseEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(date) {
  const d = parseEventDate(date);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDeadline(deadline) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || '')) return '';
  return new Date(`${deadline}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}
