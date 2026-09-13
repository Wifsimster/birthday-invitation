// The two files a crawler asks for before it reads any page.

import type { EventRow } from '../db.ts';
import { escapeHtml } from './escape.ts';
import { eventPath } from './meta.ts';

/**
 * robots.txt: keep crawlers out of the admin console, the sign-in/registration
 * pages and the JSON API. Those pages also carry `noindex, nofollow` via
 * FALLBACK_META; this keeps crawlers from spending requests on them at all.
 */
export function buildRobotsTxt(origin: string, allowIndex = true): string {
  const lines = ['User-agent: *'];
  if (allowIndex) {
    lines.push(
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /pending',
      'Disallow: /api/'
    );
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
