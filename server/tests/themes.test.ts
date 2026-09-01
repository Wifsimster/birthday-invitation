/*
 * The theme catalog is deliberately duplicated: the browser reads
 * frontend/src/themes.js, and the share-card rasteriser — which never loads the
 * SPA — reads server/src/themes.ts. Duplication that nothing checks drifts, and
 * the failure mode is silent: an event keeps rendering, its Open Graph card
 * just quietly shows the wrong colours (or 404s on an id the server rejects).
 *
 * So this reads the frontend catalog directly and asserts the mirror matches.
 */
import { describe, it, expect } from 'vitest';
import { THEME_IDS, THEME_PALETTES, DEFAULT_THEME, isThemeId } from '../src/themes.ts';
// @ts-expect-error — plain ESM from the frontend package, no types alongside it.
import { THEMES, DEFAULT_THEME as FRONTEND_DEFAULT } from '../../frontend/src/themes.js';

const frontendThemes = THEMES as Record<
  string,
  { label: string; icon: string; palette: Record<string, string>; heroEmojis: string[]; decorations: string[]; copy: { title: string; subtitle: string } }
>;

const MIRRORED_KEYS = [
  'bgFrom', 'bgVia', 'bgTo', 'cardBg', 'cardText', 'primary', 'badgeFrom', 'badgeTo', 'badgeText'
] as const;

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
      expect(theme.heroEmojis.length, `${id} heroEmojis`).toBeGreaterThan(0);
      // The invitation scatters decorations over six fixed slots.
      expect(theme.decorations.length, `${id} decorations`).toBe(6);
      expect(theme.copy.title, `${id} copy.title`).toBeTruthy();
      expect(theme.copy.subtitle, `${id} copy.subtitle`).toBeTruthy();
      for (const key of MIRRORED_KEYS) {
        expect(theme.palette[key], `${id} palette.${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});
