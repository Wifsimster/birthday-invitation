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

// Colours each theme paints the Open Graph share card with (see og-image.ts).
//
// The browser gets its palette from frontend/src/themes.js; the card is
// rasterised here, in a process that never loads the SPA, so it needs its own
// copy. Only the handful of colours the card actually draws with are mirrored,
// and they MUST stay in sync with the matching `palette` entries there.
export interface ThemePalette {
  bgFrom: string;
  bgVia: string;
  bgTo: string;
  cardBg: string;
  cardText: string;
  primary: string;
  badgeFrom: string;
  badgeTo: string;
  badgeText: string;
}

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  fiesta: { bgFrom: '#FF5C8A', bgVia: '#7B5BFF', bgTo: '#21D4FD', cardBg: '#FFFFFF', cardText: '#1F2333', primary: '#FF4D6D', badgeFrom: '#FFB703', badgeTo: '#FB8500', badgeText: '#1F2333' },
  spiderman: { bgFrom: '#C1121F', bgVia: '#1E3A8A', bgTo: '#0B1220', cardBg: '#FFFFFF', cardText: '#16213E', primary: '#E23636', badgeFrom: '#E23636', badgeTo: '#1D4ED8', badgeText: '#FFFFFF' },
  ironman: { bgFrom: '#7A0C16', bgVia: '#B71C2B', bgTo: '#C9930B', cardBg: '#FFFDF5', cardText: '#2A1206', primary: '#D7263D', badgeFrom: '#FFC300', badgeTo: '#E08A00', badgeText: '#2A1206' },
  pawpatrol: { bgFrom: '#00A0E3', bgVia: '#1976D2', bgTo: '#0B5394', cardBg: '#FFFFFF', cardText: '#16334A', primary: '#0085CA', badgeFrom: '#FFD200', badgeTo: '#FFA000', badgeText: '#16334A' },
  mickey: { bgFrom: '#E63946', bgVia: '#C1121F', bgTo: '#1A1A1A', cardBg: '#FFFFFF', cardText: '#1A1A1A', primary: '#D7141A', badgeFrom: '#FFC60A', badgeTo: '#F59E0B', badgeText: '#1A1A1A' },
  princess: { bgFrom: '#FAD0E4', bgVia: '#E7B6E8', bgTo: '#C9B6F2', cardBg: '#FFFBFE', cardText: '#4A2740', primary: '#E86AA6', badgeFrom: '#F3D27A', badgeTo: '#E0A93B', badgeText: '#4A2740' },
  dino: { bgFrom: '#3FA34D', bgVia: '#1E7A46', bgTo: '#14532D', cardBg: '#FDFBF3', cardText: '#22331C', primary: '#2E8B57', badgeFrom: '#E8B23A', badgeTo: '#C8860F', badgeText: '#22331C' },
  space: { bgFrom: '#1E1B4B', bgVia: '#3B0764', bgTo: '#0B1026', cardBg: '#FFFFFF', cardText: '#1A1633', primary: '#7C3AED', badgeFrom: '#22D3EE', badgeTo: '#3B82F6', badgeText: '#07223A' },
  unicorn: { bgFrom: '#FFC8DD', bgVia: '#C8B6FF', bgTo: '#A0E7E5', cardBg: '#FFFCFE', cardText: '#46264D', primary: '#FF7EB9', badgeFrom: '#FFD166', badgeTo: '#FF9A8B', badgeText: '#46264D' },
};

export function getPalette(theme: string): ThemePalette {
  return THEME_PALETTES[theme as ThemeId] ?? THEME_PALETTES[DEFAULT_THEME];
}
