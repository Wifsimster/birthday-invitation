// The set of theme ids the API will accept for the selectable UI theme.
// The rich visual definition of each theme (palette, fonts, emojis, copy, and
// the structural CSS in frontend/src/assets/themes.css) lives in the frontend;
// this list is the server-side allow-list used for validation and MUST stay in
// sync with it — tests/themes.test.ts reads the frontend catalog and fails when
// the two drift apart.
export const THEME_IDS = [
  'kid',
  'floral',
  'neon',
  'robotic',
  'retro',
  'modern',
  'elegant'
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

// Default theme used when the admin has never chosen one. Keep in sync with the
// frontend DEFAULT_THEME.
export const DEFAULT_THEME: ThemeId = 'kid';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

/*
 * Where the retired catalog went.
 *
 * The themes up to v1.11 were palette-and-emoji skins of one layout: a licensed
 * character or a motif, all rendered as the same white card. They were replaced
 * by seven themes that each carry their own structure. This maps every retired
 * id onto the survivor closest to how it actually looked, so events created
 * under the old catalog keep a deliberate appearance instead of silently
 * falling back to the default.
 *
 * Applied by the v5 migration in db.ts. Kept here, beside the allow-list, so a
 * stored value that predates it can still be recognised — a database restored
 * from an old backup arrives through the same door.
 */
export const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  fiesta: 'kid',
  pawpatrol: 'kid',
  mickey: 'kid',
  dino: 'kid',
  jungle: 'kid',
  princess: 'floral',
  unicorn: 'floral',
  mermaid: 'floral',
  boho: 'floral',
  y2k: 'neon',
  ironman: 'robotic',
  space: 'robotic',
  gaming: 'robotic',
  spiderman: 'retro',
  manga: 'retro',
  skate: 'retro',
  foot: 'modern'
};

// The theme to render `value` with: itself when current, its replacement when
// retired, the default otherwise.
export function resolveThemeId(value: unknown): ThemeId {
  if (isThemeId(value)) return value;
  if (typeof value === 'string' && LEGACY_THEME_ALIASES[value]) return LEGACY_THEME_ALIASES[value];
  return DEFAULT_THEME;
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
  kid: { bgFrom: '#FFD166', bgVia: '#EF476F', bgTo: '#6C63FF', cardBg: '#FFFFFF', cardText: '#21243D', primary: '#E8443C', badgeFrom: '#FFD75E', badgeTo: '#FF9F1C', badgeText: '#21243D' },
  floral: { bgFrom: '#F6E7DC', bgVia: '#E0BFB8', bgTo: '#9DAE8E', cardBg: '#FFFCF8', cardText: '#3A2E2A', primary: '#A8446B', badgeFrom: '#F3D9C6', badgeTo: '#E4B7A0', badgeText: '#3A2E2A' },
  neon: { bgFrom: '#2B0B45', bgVia: '#5B0F8B', bgTo: '#0A0A1A', cardBg: '#141126', cardText: '#F2EEFF', primary: '#FF3D9A', badgeFrom: '#FF3D9A', badgeTo: '#A855F7', badgeText: '#1A0A18' },
  robotic: { bgFrom: '#0B1220', bgVia: '#12203A', bgTo: '#030712', cardBg: '#0E1626', cardText: '#DCE7F5', primary: '#22D3EE', badgeFrom: '#22D3EE', badgeTo: '#38BDF8', badgeText: '#04222E' },
  retro: { bgFrom: '#FFD400', bgVia: '#FF7A00', bgTo: '#00A8B0', cardBg: '#FFF8E7', cardText: '#141414', primary: '#D6004A', badgeFrom: '#FFD400', badgeTo: '#FFAE00', badgeText: '#141414' },
  modern: { bgFrom: '#EEF1F7', bgVia: '#C3CDDF', bgTo: '#6B7A93', cardBg: '#FFFFFF', cardText: '#111827', primary: '#2F5BFF', badgeFrom: '#E7ECF5', badgeTo: '#CBD5E1', badgeText: '#111827' },
  elegant: { bgFrom: '#39414F', bgVia: '#1E2531', bgTo: '#0D1116', cardBg: '#FBF7EF', cardText: '#22252B', primary: '#8C6D2C', badgeFrom: '#EBDCB4', badgeTo: '#D9BE70', badgeText: '#22252B' },
};

export function getPalette(theme: string): ThemePalette {
  return THEME_PALETTES[resolveThemeId(theme)];
}
