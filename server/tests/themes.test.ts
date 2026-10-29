import { describe, it, expect } from 'vitest';
import {
  THEME_IDS, THEME_PALETTES, DEFAULT_THEME, LEGACY_THEME_ALIASES,
  isThemeId, resolveThemeId, getPalette
} from '../src/themes.ts';
import { openDb, initSchema } from '../src/db.ts';
// @ts-expect-error — plain ESM from the frontend package, no types alongside it.
import { THEMES, DEFAULT_THEME as FRONTEND_DEFAULT } from '../../frontend/src/themes.js';

const frontendThemes = THEMES as Record<
  string,
  {
    label: string; icon: string; blurb: string;
    palette: Record<string, string>;
    fonts: { display: string; body: string };
    heroEmojis: string[]; decorations: string[];
    copy: { title: string; subtitle: string };
  }
>;

const MIRRORED_KEYS = [
  'bgFrom', 'bgVia', 'bgTo', 'cardBg', 'cardText', 'primary', 'badgeFrom', 'badgeTo', 'badgeText'
] as const;

const RETIRED_IDS = [
  'fiesta', 'spiderman', 'ironman', 'pawpatrol', 'mickey', 'princess', 'dino', 'space',
  'unicorn', 'y2k', 'gaming', 'foot', 'mermaid', 'jungle', 'manga', 'boho', 'skate'
];

describe('theme catalog', () => {
  it('allow-list matches the frontend catalog, in the same order', () => {
    expect([...THEME_IDS]).toEqual(Object.keys(frontendThemes));
  });

  it('agrees with the frontend on the default theme', () => {
    expect(DEFAULT_THEME).toBe(FRONTEND_DEFAULT);
    expect(isThemeId(DEFAULT_THEME)).toBe(true);
  });

  it('mirrors the share-card colours of every theme', () => {
    for (const id of THEME_IDS) {
      const expected = Object.fromEntries(
        MIRRORED_KEYS.map((k) => [k, frontendThemes[id].palette[k]])
      );
      expect({ [id]: THEME_PALETTES[id] }).toEqual({ [id]: expected });
    }
  });

  it('describes every theme fully enough to render an invitation', () => {
    for (const id of THEME_IDS) {
      const theme = frontendThemes[id];
      expect(theme.label, `${id} label`).toBeTruthy();
      expect(theme.icon, `${id} icon`).toBeTruthy();
      expect(theme.blurb, `${id} blurb`).toBeTruthy();
      expect(theme.fonts.display, `${id} fonts.display`).toBeTruthy();
      expect(theme.fonts.body, `${id} fonts.body`).toBeTruthy();
      expect(theme.heroEmojis.length, `${id} heroEmojis`).toBeGreaterThan(0);
      expect(theme.decorations.length, `${id} decorations`).toBeGreaterThan(0);
      expect(theme.decorations.length, `${id} decorations`).toBeLessThanOrEqual(6);
      expect(theme.copy.title, `${id} copy.title`).toBeTruthy();
      expect(theme.copy.subtitle, `${id} copy.subtitle`).toBeTruthy();
      for (const key of MIRRORED_KEYS) {
        expect(theme.palette[key], `${id} palette.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe('retired theme ids', () => {
  it('every id the old catalog could have stored has a replacement', () => {
    for (const id of RETIRED_IDS) {
      expect(LEGACY_THEME_ALIASES[id] ?? id, `${id} alias`).toBeTruthy();
      expect(isThemeId(resolveThemeId(id)), `${id} resolves`).toBe(true);
    }
  });

  it('every alias points at a theme that still exists', () => {
    for (const [legacy, current] of Object.entries(LEGACY_THEME_ALIASES)) {
      expect(isThemeId(current), `${legacy} -> ${current}`).toBe(true);
      expect(isThemeId(legacy), `${legacy} is retired`).toBe(false);
    }
  });

  it('resolves an unknown value to the default rather than throwing', () => {
    expect(resolveThemeId('not-a-theme')).toBe(DEFAULT_THEME);
    expect(resolveThemeId(undefined)).toBe(DEFAULT_THEME);
    expect(getPalette('not-a-theme')).toEqual(THEME_PALETTES[DEFAULT_THEME]);
  });
});

const slugFor = (theme: string) => `stored-${theme}`;

describe('theme migration', () => {
  it('rewrites stored ids from the retired catalog', () => {
    const db = openDb(':memory:');
    initSchema(db);

    const rows = [...RETIRED_IDS, 'kid', 'hand-edited-nonsense'];
    for (const theme of rows) {
      db.run('INSERT INTO event (slug, person, theme) VALUES (?, ?, ?)', [slugFor(theme), theme, theme]);
    }
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme', 'pawpatrol']);

    db.run('PRAGMA user_version = 4');
    initSchema(db);

    const stored = db.all<{ slug: string; theme: string }>('SELECT slug, theme FROM event');
    const themeOf = (legacy: string) => stored.find((r) => r.slug === slugFor(legacy))?.theme;

    for (const row of stored) {
      expect(isThemeId(row.theme), `${row.slug} -> ${row.theme}`).toBe(true);
    }
    expect(themeOf('spiderman')).toBe('retro');
    expect(themeOf('princess')).toBe('floral');
    expect(themeOf('gaming')).toBe('robotic');
    expect(themeOf('kid')).toBe('kid');
    expect(themeOf('hand-edited-nonsense')).toBe(DEFAULT_THEME);
    expect(db.get('SELECT value FROM settings WHERE key = ?', ['theme'])).toBeUndefined();
  });
});
