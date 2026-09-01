// The set of theme ids the API will accept for the selectable UI theme.
// The rich visual definition of each theme (palette, fonts, emojis, copy) lives
// in the frontend (frontend/src/themes.js); this list is the server-side
// allow-list used for validation and MUST stay in sync with it — tests/themes.test.ts
// reads the frontend catalog and fails when the two drift apart.
export const THEME_IDS = [
  'fiesta',
  'spiderman',
  'ironman',
  'pawpatrol',
  'mickey',
  'princess',
  'dino',
  'space',
  'unicorn',
  'neon',
  'gaming',
  'y2k',
  'foot',
  'mermaid',
  'jungle',
  'manga',
  'boho',
  'skate'
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
  fiesta: { bgFrom: '#FF5C8A', bgVia: '#7B5BFF', bgTo: '#21D4FD', cardBg: '#FFFFFF', cardText: '#1F2333', primary: '#E4265A', badgeFrom: '#FFC94D', badgeTo: '#FB8500', badgeText: '#1F2333' },
  spiderman: { bgFrom: '#C1121F', bgVia: '#1E3A8A', bgTo: '#0B1220', cardBg: '#FFFFFF', cardText: '#16213E', primary: '#CE1B26', badgeFrom: '#CE1B26', badgeTo: '#1D4ED8', badgeText: '#FFFFFF' },
  ironman: { bgFrom: '#7A0C16', bgVia: '#B71C2B', bgTo: '#C9930B', cardBg: '#FFFDF5', cardText: '#2A1206', primary: '#C31F33', badgeFrom: '#FFC300', badgeTo: '#E08A00', badgeText: '#2A1206' },
  pawpatrol: { bgFrom: '#00A0E3', bgVia: '#1976D2', bgTo: '#0B5394', cardBg: '#FFFFFF', cardText: '#16334A', primary: '#00679E', badgeFrom: '#FFD200', badgeTo: '#FFA000', badgeText: '#16334A' },
  mickey: { bgFrom: '#E63946', bgVia: '#C1121F', bgTo: '#1A1A1A', cardBg: '#FFFFFF', cardText: '#1A1A1A', primary: '#C9121A', badgeFrom: '#FFC60A', badgeTo: '#F59E0B', badgeText: '#1A1A1A' },
  princess: { bgFrom: '#FAD0E4', bgVia: '#E7B6E8', bgTo: '#C9B6F2', cardBg: '#FFFBFE', cardText: '#40203A', primary: '#C43D80', badgeFrom: '#F3D27A', badgeTo: '#E0A93B', badgeText: '#40203A' },
  dino: { bgFrom: '#3FA34D', bgVia: '#1E7A46', bgTo: '#14532D', cardBg: '#FDFBF3', cardText: '#22331C', primary: '#1F7A4C', badgeFrom: '#F0C154', badgeTo: '#D9930F', badgeText: '#22331C' },
  space: { bgFrom: '#1E1B4B', bgVia: '#3B0764', bgTo: '#0B1026', cardBg: '#FFFFFF', cardText: '#1A1633', primary: '#6D28D9', badgeFrom: '#67E8F9', badgeTo: '#38BDF8', badgeText: '#07223A' },
  unicorn: { bgFrom: '#FFC8DD', bgVia: '#C8B6FF', bgTo: '#A0E7E5', cardBg: '#FFFCFE', cardText: '#3F2046', primary: '#D6337F', badgeFrom: '#FFD166', badgeTo: '#FFB08B', badgeText: '#3F2046' },
  neon: { bgFrom: '#2B0B45', bgVia: '#5B0F8B', bgTo: '#0A0A1A', cardBg: '#141126', cardText: '#F2EEFF', primary: '#FF3D9A', badgeFrom: '#FF3D9A', badgeTo: '#A855F7', badgeText: '#1A0A18' },
  gaming: { bgFrom: '#0F172A', bgVia: '#1E293B', bgTo: '#020617', cardBg: '#101828', cardText: '#E6EDF7', primary: '#4ADE80', badgeFrom: '#4ADE80', badgeTo: '#22D3EE', badgeText: '#052E16' },
  y2k: { bgFrom: '#7DD3FC', bgVia: '#C084FC', bgTo: '#F0ABFC', cardBg: '#18122B', cardText: '#F3EDFF', primary: '#FF5FD0', badgeFrom: '#7DF9FF', badgeTo: '#C4B5FD', badgeText: '#151033' },
  foot: { bgFrom: '#22A24F', bgVia: '#0E7A3C', bgTo: '#053C1F', cardBg: '#FFFFFF', cardText: '#111C16', primary: '#0B7A3B', badgeFrom: '#F5C518', badgeTo: '#E09B00', badgeText: '#111C16' },
  mermaid: { bgFrom: '#7DE2D1', bgVia: '#3AA8C1', bgTo: '#1B4E8E', cardBg: '#F7FDFC', cardText: '#123240', primary: '#0A7A88', badgeFrom: '#FFB3C1', badgeTo: '#F0788C', badgeText: '#123240' },
  jungle: { bgFrom: '#7CB342', bgVia: '#2F7D32', bgTo: '#1B4332', cardBg: '#FFFCF2', cardText: '#26301C', primary: '#2F7D32', badgeFrom: '#F7C244', badgeTo: '#E0900F', badgeText: '#26301C' },
  manga: { bgFrom: '#FBCFE8', bgVia: '#E0567F', bgTo: '#1E2A5A', cardBg: '#FFFBFC', cardText: '#1B2138', primary: '#D6296B', badgeFrom: '#FBBF24', badgeTo: '#F59E0B', badgeText: '#1B2138' },
  boho: { bgFrom: '#EFE0D0', bgVia: '#C89A6E', bgTo: '#7C5F45', cardBg: '#FFFBF4', cardText: '#33291F', primary: '#A8532F', badgeFrom: '#E4C08A', badgeTo: '#D9A441', badgeText: '#33291F' },
  skate: { bgFrom: '#F2A65A', bgVia: '#E4572E', bgTo: '#2D3142', cardBg: '#FFFDF9', cardText: '#20242F', primary: '#E4572E', badgeFrom: '#4FE3E0', badgeTo: '#17BEBB', badgeText: '#0A2426' },
};

export function getPalette(theme: string): ThemePalette {
  return THEME_PALETTES[theme as ThemeId] ?? THEME_PALETTES[DEFAULT_THEME];
}
