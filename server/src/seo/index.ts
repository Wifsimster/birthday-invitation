// Search-engine and social-preview metadata for the SPA.
//
// The invitation is a client-rendered React app: crawlers and — more importantly
// for an invitation — the link scrapers behind WhatsApp, Messenger, iMessage,
// Slack and X never run our JavaScript. They read the HTML shell and nothing
// else. So the shell they receive must already carry the right <title>,
// description, canonical URL, Open Graph/Twitter tags and JSON-LD for the event
// being requested. This is built here and injected into dist/index.html per
// request (see routes/spa.routes.ts).
//
// The work is split by what would make it change: the metadata model (meta.ts),
// how it is written into the shell (html.ts), the two crawler files
// (crawlers.ts), where the page thinks it lives (origin.ts) and the escaping the
// three of them share (escape.ts). This module is their public surface.

export { escapeHtml } from './escape.ts';
export { indexingAllowed, resolveOrigin } from './origin.ts';
export { buildEventMeta, eventPath, FALLBACK_META, SITE_NAME, type SeoMeta } from './meta.ts';
export { renderIndexHtml } from './html.ts';
export { buildRobotsTxt, buildSitemapXml } from './crawlers.ts';
