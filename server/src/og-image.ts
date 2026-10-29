import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import type { EventRow } from './db.ts';
import { getPalette } from './themes.ts';
import { isRsvpClosed, eventConfigFromRow } from './domain/event.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_FILES = [
  path.join(FONT_DIR, 'Baloo2-Regular.ttf'),
  path.join(FONT_DIR, 'Baloo2-Bold.ttf')
];

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

export function stripPictographs(value: unknown): string {
  return String(value ?? '')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\u20E3/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

function fitFontSize(text: string, maxWidth: number, max: number, min: number): number {
  if (!text) return max;
  const ideal = Math.floor((maxWidth / (text.length * 0.55)) * 10) / 10;
  return Math.max(min, Math.min(max, ideal));
}

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

export function buildOgSvg(row: EventRow): string {
  const p = getPalette(row.theme);
  const c = cardContent(row);

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

  const body: string[] = [];
  let y = 306;

  if (c.badge) {
    const badgeSize = 34;
    const badgeH = 62;
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

export function renderOgPng(row: EventRow): Buffer {
  const resvg = new Resvg(buildOgSvg(row), {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT_FAMILY }
  });
  return Buffer.from(resvg.render().asPng());
}

export function ogImageAlt(row: EventRow): string {
  const c = cardContent(row);
  return [c.heading, c.when].filter(Boolean).join(' — ');
}
