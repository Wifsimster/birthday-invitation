#!/usr/bin/env node
/*
 * Contrast audit for the theme catalog (src/themes.js).
 *
 * Every theme paints the same invitation, so a palette that looks lovely as a
 * row of swatches can still ship unreadable body copy. This walks each theme
 * and checks the pairs the invitation actually renders against the WCAG 2.1
 * contrast minimums — 4.5:1 for body text, 3:1 for the large display numbers.
 *
 * Run with `npm run check:themes`. Exits non-zero on any failure.
 */
import { THEMES } from '../src/themes.js';

const AA = 4.5;
const AA_LARGE = 3;

/** Relative luminance of a #rrggbb colour (WCAG 2.1, 1.4.3). */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Opaque result of laying `fg` over `bg` at `weight` alpha — mirrors color-mix(). */
function mix(fg, bg, weight) {
  const a = parseInt(fg.slice(1), 16);
  const b = parseInt(bg.slice(1), 16);
  const channel = (shift) =>
    Math.round((((a >> shift) & 255) * weight) + (((b >> shift) & 255) * (1 - weight)));
  return '#' + [16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('');
}

// Kept in step with the --muted-foreground mix in src/assets/index.css.
const MUTED_WEIGHT = 0.72;

/** The colour pairs the invitation actually stacks, per theme. */
function checks(p) {
  const headerFrom = p.headerFrom || p.primary;
  const headerTo = p.headerTo || p.primaryDark;
  return [
    ['body text on card', p.cardText, p.cardBg, AA],
    ['muted text on card', mix(p.cardText, p.cardBg, MUTED_WEIGHT), p.cardBg, AA],
    ['section heading on card', p.primaryDark, p.cardBg, AA],
    ['display accent on card', p.primary, p.cardBg, AA_LARGE],
    ['header text on gradient start', p.headerText, headerFrom, AA],
    ['header text on gradient end', p.headerText, headerTo, AA],
    ['badge text on gradient start', p.badgeText, p.badgeFrom, AA],
    ['badge text on gradient end', p.badgeText, p.badgeTo, AA],
    ['button text on gradient start', p.buttonText, p.buttonFrom, AA],
    ['button text on gradient end', p.buttonText, p.buttonTo, AA]
  ];
}

let failures = 0;
for (const [id, theme] of Object.entries(THEMES)) {
  const bad = checks(theme.palette)
    .map(([label, fg, bg, min]) => ({ label, fg, bg, min, ratio: contrast(fg, bg) }))
    .filter((r) => r.ratio < r.min);

  failures += bad.length;
  console.log(`${bad.length ? '✗' : '✓'} ${id}${bad.length ? ` — ${bad.length} issue(s)` : ''}`);
  for (const r of bad) {
    console.log(
      `    ${r.label}: ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1) — ${r.fg} on ${r.bg}`
    );
  }
}

const count = Object.keys(THEMES).length;
if (failures) {
  console.error(`\n${failures} contrast failure(s) across ${count} themes.`);
  process.exit(1);
}
console.log(`\nAll ${count} themes clear WCAG AA.`);
