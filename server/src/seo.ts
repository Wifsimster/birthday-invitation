// Search-engine and social-preview metadata for the SPA.
//
// The invitation is a client-rendered Vue app: crawlers and — more importantly
// for an invitation — the link scrapers behind WhatsApp, Messenger, iMessage,
// Slack and X never run our JavaScript. They read the HTML shell and nothing
// else. So the shell they receive must already carry the right <title>,
// description, canonical URL, Open Graph/Twitter tags and JSON-LD for the event
// being requested. This module builds that metadata and injects it into
// dist/index.html per request (see the static SPA section of app.ts).

import type { EventRow } from './db.ts';
import { isRsvpClosed, eventConfigFromRow } from './event.ts';
import { OG_WIDTH, OG_HEIGHT, ogImageAlt } from './og-image.ts';

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  // Absolute URL of the share card, and its alt text. Absent when no origin is
  // known (a relative og:image is ignored by every scraper) or for a page with
  // no event behind it.
  ogImage?: { url: string; alt: string };
  // JSON-LD payload (schema.org Event), omitted when the event has no date.
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = 'Invitation d\'anniversaire';

// Generic copy used for the /admin route and for a slug that matches no event —
// neither should ever be the target of a search result or a link preview.
export const FALLBACK_META: SeoMeta = {
  title: SITE_NAME,
  description: 'Invitation d\'anniversaire en ligne avec réponse (RSVP) en un clic.',
  canonical: '',
  robots: 'noindex, nofollow'
};

/** Escape a value for interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only a plausible host:port is accepted from the request. The Host header is
// client-controlled, so an unvalidated value would let a visitor choose the
// canonical/og:url we advertise for the page.
const HOST_RE = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

/**
 * Public origin the page is served from, e.g. "https://leo.example.com".
 * Prefers the explicitly configured origin; falls back to the (validated)
 * request host so a plain `docker run` still emits usable absolute URLs.
 */
export function resolveOrigin(
  req: { protocol?: string; get(name: string): string | undefined },
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = env.PUBLIC_BASE_URL || env.BETTER_AUTH_URL || '';
  if (configured) return configured.replace(/\/+$/, '');
  const host = req.get('host') ?? '';
  if (!HOST_RE.test(host)) return '';
  return `${req.protocol || 'http'}://${host}`;
}

/** True unless the operator opted out of being indexed (SEO_ALLOW_INDEXING=false). */
export function indexingAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return !/^(0|false|no|off)$/i.test(String(env.SEO_ALLOW_INDEXING ?? '').trim());
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

/** Path of an event's invitation, "/" for the default event. */
export function eventPath(row: EventRow): string {
  return row.is_default ? '/' : `/e/${encodeURIComponent(row.slug)}`;
}

/**
 * Metadata describing one event's invitation page.
 *
 * The description is what a guest actually sees under the link in a search
 * result or a chat preview, so it leads with the facts that decide whether they
 * tap: who, how old, when and where.
 */
export function buildEventMeta(row: EventRow, origin: string, allowIndex = true): SeoMeta {
  const person = row.person?.trim();
  if (!person) return { ...FALLBACK_META, canonical: origin ? `${origin}${eventPath(row)}` : '' };

  const age = String(row.age ?? '').trim();
  const title = age
    ? `Anniversaire de ${person} — ${age} ans | Invitation`
    : `Anniversaire de ${person} | Invitation`;

  const readableDate = formatDate(row.date);
  const when = [readableDate, row.time?.trim()].filter(Boolean).join(' à ');
  const where = [row.location?.trim(), row.town?.trim()].filter(Boolean).join(', ');
  const description = [
    age ? `${person} fête ses ${age} ans !` : `${person} fête son anniversaire !`,
    when && `Rendez-vous ${when}.`,
    where && `${where}.`,
    isRsvpClosed(eventConfigFromRow(row))
      ? 'Les réponses sont closes.'
      : 'Réponds à l\'invitation en un clic.'
  ].filter(Boolean).join(' ');

  const canonical = origin ? `${origin}${eventPath(row)}` : '';

  const meta: SeoMeta = {
    title,
    description,
    canonical,
    robots: allowIndex ? 'index, follow' : 'noindex, follow'
  };

  if (origin) {
    const slugPath = row.is_default
      ? '/api/og.png'
      : `/api/events/${encodeURIComponent(row.slug)}/og.png`;
    meta.ogImage = { url: `${origin}${slugPath}`, alt: ogImageAlt(row) };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    meta.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: age ? `Anniversaire de ${person} (${age} ans)` : `Anniversaire de ${person}`,
      description,
      startDate: row.date,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      ...(canonical ? { url: canonical } : {}),
      ...(meta.ogImage ? { image: meta.ogImage.url } : {}),
      ...(where
        ? {
            location: {
              '@type': 'Place',
              name: row.location?.trim() || row.town?.trim(),
              address: { '@type': 'PostalAddress', addressLocality: row.town?.trim() || undefined }
            }
          }
        : {})
    };
  }

  return meta;
}

/**
 * Serialize a JSON-LD payload for embedding in a <script> element.
 *
 * A script element's content is raw text, *not* parsed HTML: entities inside it
 * are never decoded, so HTML-escaping the payload would hand crawlers invalid
 * JSON. Escaping the three characters that could otherwise close the element
 * early as JSON \u sequences keeps the document safe and the JSON valid.
 */
function escapeJsonLd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/** The <meta>/<link>/<script> block that replaces the shell's placeholders. */
function renderHead(meta: SeoMeta): string {
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${escapeHtml(meta.robots)}" />`,
    meta.canonical && `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    meta.canonical && `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    meta.ogImage && `<meta property="og:image" content="${escapeHtml(meta.ogImage.url)}" />`,
    meta.ogImage && `<meta property="og:image:type" content="image/png" />`,
    meta.ogImage && `<meta property="og:image:width" content="${OG_WIDTH}" />`,
    meta.ogImage && `<meta property="og:image:height" content="${OG_HEIGHT}" />`,
    meta.ogImage && `<meta property="og:image:alt" content="${escapeHtml(meta.ogImage.alt)}" />`,
    // A card carrying an image earns the large layout; without one, the small
    // layout avoids reserving a blank thumbnail slot.
    `<meta name="twitter:card" content="${meta.ogImage ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    meta.ogImage && `<meta name="twitter:image" content="${escapeHtml(meta.ogImage.url)}" />`,
    meta.ogImage && `<meta name="twitter:image:alt" content="${escapeHtml(meta.ogImage.alt)}" />`
  ].filter(Boolean);

  if (meta.jsonLd) {
    tags.push(
      `<script type="application/ld+json">${escapeJsonLd(meta.jsonLd)}</script>`
    );
  }

  return tags.join('\n    ');
}

/**
 * Rewrite the built shell with this request's metadata: the <title> is replaced,
 * and everything between the `<!--seo-->` / `<!--/seo-->` markers — the build's
 * generic defaults — is swapped out for this event's tags. The block is
 * appended just before </head> when the markers are absent.
 */
export function renderIndexHtml(html: string, meta: SeoMeta): string {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  const block = renderHead(meta);
  const region = /<!--seo-->[\s\S]*?<!--\/seo-->/;
  if (region.test(out)) {
    out = out.replace(region, block);
  } else if (out.includes('<!--seo-->')) {
    out = out.replace('<!--seo-->', block);
  } else {
    out = out.replace(/<\/head>/i, `    ${block}\n</head>`);
  }
  return out;
}

/** robots.txt: keep crawlers out of the admin console and the JSON API. */
export function buildRobotsTxt(origin: string, allowIndex = true): string {
  const lines = ['User-agent: *'];
  if (allowIndex) {
    lines.push('Allow: /', 'Disallow: /admin', 'Disallow: /api/');
    if (origin) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  } else {
    lines.push('Disallow: /');
  }
  return lines.join('\n') + '\n';
}

/** sitemap.xml listing every event invitation. */
export function buildSitemapXml(rows: EventRow[], origin: string): string {
  const urls = rows
    .map((row) => {
      const loc = `${origin}${eventPath(row)}`;
      const lastmod = String(row.updated_at ?? '').slice(0, 10);
      return [
        '  <url>',
        `    <loc>${escapeHtml(loc)}</loc>`,
        /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `    <lastmod>${lastmod}</lastmod>` : '',
        '  </url>'
      ].filter(Boolean).join('\n');
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
