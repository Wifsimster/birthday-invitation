export type Attending = 'yes' | 'no';

export function normalizePhone(raw: unknown): string {
  const trimmed = String(raw ?? '').trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
}

export function guestCount(attending: Attending, guests?: number | null): number {
  return attending === 'yes' ? (guests || 1) : 0;
}

export function shareFlag(attending: Attending, consent?: boolean, current = false): number {
  if (attending !== 'yes') return 0;
  return (consent ?? current) ? 1 : 0;
}

export function optionalText(value?: string | null): string | null {
  return value ? value : null;
}
