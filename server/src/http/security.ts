import compression from 'compression';
import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../logger.ts';

const PHONE_IN_PATH = /(\/api\/(?:events\/[^/]+\/)?(?:rsvp\/lookup|participants))\/[^?]+/;

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

export function crossOrigin(corsOrigin: string): RequestHandler {
  return cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true });
}

export { compression };
