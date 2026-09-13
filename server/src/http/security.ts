// The middleware stack every request passes through before reaching a route:
// request logging with the guest's phone number masked, compression, the
// content-security policy, and cross-origin access.

import compression from 'compression';
import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../logger.ts';

// Both the un-slugged and the event-scoped lookup variants, plus the guest list
// route, carry the phone number as the last path segment.
const PHONE_IN_PATH = /(\/api\/(?:events\/[^/]+\/)?(?:rsvp\/lookup|participants))\/[^?]+/;

/**
 * Request logging. The phone-lookup routes carry the phone number in the URL
 * path; mask it so guest phone numbers never land in the request logs.
 */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    serializers: {
      req(req: { url?: string }) {
        if (req.url) req.url = req.url.replace(PHONE_IN_PATH, '$1/[redacted]');
        return req;
      }
    }
  });
}

/**
 * Restrictive CSP that still allows the font/icon CDNs the SPA loads and the
 * inline styles the SPA sets. 'unsafe-inline' for styles is required by the
 * per-theme `style` attributes the invitation renders.
 *
 * umami.battistella.ovh est notre propre instance de mesure d'audience, pas un
 * tiers. Elle a besoin de DEUX directives : scriptSrc pour charger stats.js et
 * recorder.js, connectSrc pour poster la mesure. N'en ouvrir qu'une donne une
 * panne silencieuse — le script se charge et n'émet rien.
 */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://umami.battistella.ovh'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://umami.battistella.ovh'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
      }
    }
  });
}

/**
 * Same-origin SPA: only enable CORS when an explicit origin is configured
 * (e.g. a separate dev frontend). Defaults to no cross-origin access.
 */
export function crossOrigin(corsOrigin: string): RequestHandler {
  return cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true });
}

export { compression };
