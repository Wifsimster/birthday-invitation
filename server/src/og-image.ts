// The Open Graph share card.
//
// A chat preview is mostly picture: WhatsApp, Messenger, iMessage, Slack and X
// all give the image far more room than the title. This module draws one card
// per event — themed like the invitation itself — as SVG and rasterises it to
// PNG with resvg, because those scrapers accept PNG/JPEG and ignore SVG.
//
// resvg has no browser behind it: no webfonts, no emoji, no text metrics. Hence
// the bundled font files (assets/fonts/README.md), the pictograph stripping, and
// the width estimation below.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import type { EventRow } from './db.ts';
import { getPalette } from './themes.ts';
import { isRsvpClosed, eventConfigFromRow } from './event.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_FILES = [
  path.join(FONT_DIR, 'Baloo2-Regular.ttf'),
  path.join(FONT_DIR, 'Baloo2-Bold.ttf')
];

// 1.91:1, the aspect ratio every major scraper crops a large card to.
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONT_FAMILY = 'Baloo 2';

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Strip emoji and other pictographs, plus the variation selectors and joiners
 * that glue them together. The bundled subset has no glyphs for them, and an
 * unmapped codepoint draws as a tofu box — event text routinely carries them
 * ("🏠 Chez Léo").
 */
export function stripPictographs(value: unknown): string {
  return String(value ?? '')
    // Alternation rather than a character class: splitting a joined emoji
    // sequence into its parts is exactly the intent here, which is the very
    // thing a character class is linted against (no-misleading-character-class).
    // \uFE0F is the emoji variation selector, \u200D the zero-width joiner and
    // \u20E3 the keycap mark — the glue holding those sequences together.
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\u20E3/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// resvg exposes no text measurement, so estimate. Baloo 2's average advance is
// ~0.52em; caps and digits run wider, so bias up slightly to stay conservative —
// overestimating shrinks text a little, underestimating overflows the card.
function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

/** Largest size in [min, max] at which `text` is estimated to fit `maxWidth`. */
function fitFontSize(text: string, maxWidth: number, max: number, min: number): number {
  if (!text) return max;
  const ideal = Math.floor((maxWidth / (text.length * 0.55)) * 10) / 10;
  return Math.max(min, Math.min(max, ideal));
}

/** Hard cap on length: shrinking alone can't save a pathological name. */
function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d);
}

/** The card's text content, derived from the event row. */
export function cardContent(row: EventRow): {
  kicker: string;
  heading: string;
  badge: string;
  when: string;
  where: string;
  cta: string;
} {
  const person = truncate(stripPictographs(row.person), 40);
  const age = truncate(stripPictographs(row.age), 12);
  const when = [formatDate(row.date), stripPictographs(row.time)].filter(Boolean).join(' · ');
  const where = truncate(
    [stripPictographs(row.location), stripPictographs(row.town)].filter(Boolean).join(', '),
    64
  );
  return {
    kicker: 'TU ES INVITÉ(E) !',
    heading: person ? `Anniversaire de ${person}` : "Invitation d'anniversaire",
    badge: age ? `${age} ans` : '',
    when: truncate(when, 58),
    where,
    cta: isRsvpClosed(eventConfigFromRow(row))
      ? 'Les réponses sont closes'
      : "Réponds à l'invitation"
  };
}

/** The share card as an SVG document. Exported so tests can read it as text. */
export function buildOgSvg(row: EventRow): string {
  const p = getPalette(row.theme);
  const c = cardContent(row);

  // Card panel geometry. Text starts at PAD_X and must not cross the right edge.
  const INSET = 60;
  const PAD_X = 110;
  const TEXT_MAX = OG_WIDTH - INSET * 2 - (PAD_X - INSET) * 2;

  const headingSize = fitFontSize(c.heading, TEXT_MAX, 76, 40);
  const whenSize = fitFontSize(c.when, TEXT_MAX, 34, 24);
  const whereSize = fitFontSize(c.where, TEXT_MAX, 30, 22);

  const text = (
    x: number, y: number, size: number, weight: number, fill: string,
    content: string, extra = ''
  ) =>
    `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}"${extra}>${escapeXml(content)}</text>`;

  // Everything under the heading flows from a cursor, so an event missing its
  // age, date or place closes the gap instead of leaving a hole in the card.
  const body: string[] = [];
  let y = 306;

  if (c.badge) {
    const badgeSize = 34;
    const badgeH = 62;
    // The age pill is sized to its own text rather than a fixed width.
    const badgeW = Math.round(estimateWidth(c.badge, badgeSize) + 56);
    body.push(
      `<rect x="${PAD_X}" y="${y}" width="${badgeW}" height="${badgeH}" rx="${badgeH / 2}" fill="url(#badge)"/>`,
      text(PAD_X + badgeW / 2, y + 43, badgeSize, 700, p.badgeText, c.badge, ' text-anchor="middle"')
    );
    y += badgeH + 34;
  }
  if (c.when) {
    y += whenSize;
    body.push(text(PAD_X, y, whenSize, 400, p.cardText, c.when));
    y += 22;
  }
  if (c.where) {
    y += whereSize;
    body.push(text(PAD_X, y, whereSize, 400, p.cardText, c.where, ' opacity="0.72"'));
    y += 20;
  }
  body.push(text(PAD_X, y + 34, 26, 700, p.primary, c.cta));
  const blockBottom = y + 34;

  // Centre the whole text block in the panel. The block's height varies with how
  // much the event fills in, and a sparse card pinned to the top reads like a
  // rendering fault rather than a short invitation.
  const blockTop = 168 - 30;
  const dy = Math.round((INSET + (OG_HEIGHT - INSET * 2) / 2) - (blockTop + blockBottom) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.bgFrom}"/>
      <stop offset="0.5" stop-color="${p.bgVia}"/>
      <stop offset="1" stop-color="${p.bgTo}"/>
    </linearGradient>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.badgeFrom}"/>
      <stop offset="1" stop-color="${p.badgeTo}"/>
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="150" fill="#FFFFFF" opacity="0.10"/>
  <circle cx="120" cy="560" r="190" fill="#FFFFFF" opacity="0.08"/>
  <rect x="${INSET}" y="${INSET}" width="${OG_WIDTH - INSET * 2}" height="${OG_HEIGHT - INSET * 2}" rx="44" fill="${p.cardBg}"/>
  <g transform="translate(0 ${dy})">
    ${text(PAD_X, 168, 30, 700, p.primary, c.kicker, ' letter-spacing="3"')}
    ${text(PAD_X, 268, headingSize, 700, p.cardText, c.heading)}
    ${body.join('\n    ')}
  </g>
</svg>`;
}

/** Rasterise the card. Costs ~50 ms, so callers should cache the buffer. */
export function renderOgPng(row: EventRow): Buffer {
  const resvg = new Resvg(buildOgSvg(row), {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT_FAMILY }
  });
  return Buffer.from(resvg.render().asPng());
}

/** Alt text for the card, for readers who get the description but not the image. */
export function ogImageAlt(row: EventRow): string {
  const c = cardContent(row);
  return [c.heading, c.when].filter(Boolean).join(' — ');
}
