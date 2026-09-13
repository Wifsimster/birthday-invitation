// The rules a response obeys, wherever it comes from — the guest's own form, an
// admin adding a reply taken by phone, or an admin editing one afterwards. They
// used to be repeated inline in every write route, which is how a decline kept
// a stale "1 invité" on one path and lost it on another.

/** The attendance answer. Phone is the guest identity; this is their answer. */
export type Attending = 'yes' | 'no';

/**
 * Normalise a phone number to digits (keeping a leading +) so the same number
 * entered with different spacing/punctuation matches. "06 12-34" -> "0612 34".
 */
export function normalizePhone(raw: unknown): string {
  const trimmed = String(raw ?? '').trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
}

/**
 * The stored guest count for a response. A decline never carries guests — the
 * invitation hides the field and the counters ignore it — so every write path
 * normalises it the same way instead of leaving a stale "1 invité" on a row
 * switched to "Décliné".
 */
export function guestCount(attending: Attending, guests?: number | null): number {
  return attending === 'yes' ? (guests || 1) : 0;
}

/**
 * The stored sharing consent. Only a confirmed guest can appear in the list the
 * other guests see, so a decline always resets the flag — otherwise switching
 * "je viens" to "je ne viens pas" would leave the name published. `current` is
 * the value already stored, kept when the caller omits the field.
 */
export function shareFlag(attending: Attending, consent?: boolean, current = false): number {
  if (attending !== 'yes') return 0;
  return (consent ?? current) ? 1 : 0;
}

/** Empty strings are stored as NULL so "not given" reads the same everywhere. */
export function optionalText(value?: string | null): string | null {
  return value ? value : null;
}
