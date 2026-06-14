// The set of theme ids the API will accept for the selectable UI theme.
// The rich visual definition of each theme (palette, fonts, emojis, copy) lives
// in the frontend (frontend/src/themes.js); this list is the server-side
// allow-list used for validation and MUST stay in sync with it.
export const THEME_IDS = [
  'fiesta',
  'spiderman',
  'ironman',
  'pawpatrol',
  'mickey',
  'princess',
  'dino',
  'space',
  'unicorn'
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

// Default theme used when the admin has never chosen one. Keep in sync with the
// frontend DEFAULT_THEME.
export const DEFAULT_THEME: ThemeId = 'fiesta';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}
