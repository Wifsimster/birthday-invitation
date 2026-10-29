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

export const DEFAULT_THEME: ThemeId = 'kid';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

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

export function resolveThemeId(value: unknown): ThemeId {
  if (isThemeId(value)) return value;
  if (typeof value === 'string' && LEGACY_THEME_ALIASES[value]) return LEGACY_THEME_ALIASES[value];
  return DEFAULT_THEME;
}

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
