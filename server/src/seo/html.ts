// Putting the metadata into the built shell.

import { OG_WIDTH, OG_HEIGHT } from '../og-image.ts';
import { escapeHtml, escapeJsonLd } from './escape.ts';
import { SITE_NAME, type SeoMeta } from './meta.ts';

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

