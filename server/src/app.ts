import express, { type Express } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { eventConfig, type EventConfig } from './domain/event.ts';
import { compression, crossOrigin, requestLogger, securityHeaders } from './http/security.ts';
import { createErrorHandler } from './http/errors.ts';
import { requireAdmin, requireUser } from './http/guards.ts';
import { createLimiters, type RateLimitOptions } from './http/rate-limits.ts';
import { createRepositories } from './repositories/index.ts';
import { createEventService } from './services/event.service.ts';
import { createOgCardService } from './services/og-card.service.ts';
import { createRsvpService } from './services/rsvp.service.ts';
import { createUserService } from './services/user.service.ts';
import { createAccountRoutes } from './routes/account.routes.ts';
import { createDefaultEventRoutes } from './routes/default-event.routes.ts';
import { createEventRoutes } from './routes/events.routes.ts';
import { createHealthRoutes } from './routes/health.routes.ts';
import { createPublicEventRoutes } from './routes/public-event.routes.ts';
import { createSettingsRoutes } from './routes/settings.routes.ts';
import { createUserRoutes } from './routes/users.routes.ts';
import { createSpaRoutes } from './routes/spa.routes.ts';
import type { RouteDeps } from './routes/deps.ts';
import { logger as defaultLogger, type Logger } from './logger.ts';
import { createAuth, type Auth } from './auth.ts';
import type { Db } from './db.ts';

export type { SessionUser } from './auth.ts';

export interface CreateAppOptions {
  auth?: Auth;
  trustProxy?: number;
  rateLimits?: RateLimitOptions;
  event?: EventConfig;
  corsOrigin?: string;
  staticDir?: string;
  logger?: Logger;
}

export function createApp(db: Db, options: CreateAppOptions = {}): Express {
  const {
    auth = createAuth(db.raw),
    trustProxy = Number(process.env.TRUST_PROXY ?? 1),
    rateLimits = {},
    event = eventConfig(),
    corsOrigin = process.env.CORS_ORIGIN,
    staticDir = process.env.STATIC_DIR,
    logger = defaultLogger
  } = options;

  const repos = createRepositories(db);
  const limiters = createLimiters(rateLimits);
  const deps: RouteDeps = {
    auth,
    limiters,
    guards: {
      admin: [limiters.admin, requireAdmin(auth)],
      member: [limiters.admin, requireUser(auth)]
    },
    events: createEventService({
      events: repos.events,
      settings: repos.settings,
      fallbackConfig: event
    }),
    rsvps: createRsvpService(repos.rsvps),
    users: createUserService({ auth, users: repos.users, events: repos.events, logger }),
    ogCards: createOgCardService()
  };

  const app = express();

  app.set('trust proxy', trustProxy);
  app.use(requestLogger(logger));
  app.use(compression());
  app.use(securityHeaders());
  if (corsOrigin) app.use(crossOrigin(corsOrigin));

  app.use('/api/auth/sign-in', limiters.login);
  app.use('/api/auth/sign-up', limiters.email);
  app.use('/api/auth/request-password-reset', limiters.email);
  app.use('/api/auth/send-verification-email', limiters.email);
  app.all('/api/auth/*splat', toNodeHandler(auth));

  app.use(express.json({ limit: '64kb' }));
  app.use(limiters.global);

  app.use(createHealthRoutes({ checkDatabase: () => void db.get('SELECT 1') }));
  app.use(createAccountRoutes(deps));
  app.use(createUserRoutes(deps));
  app.use(createSettingsRoutes(deps));
  app.use(createDefaultEventRoutes(deps));
  app.use(createEventRoutes(deps));
  app.use(createPublicEventRoutes(deps));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ressource introuvable' });
  });

  if (staticDir) {
    app.use(createSpaRoutes({ staticDir, events: deps.events, eventRows: repos.events }));
  }

  app.use(createErrorHandler(logger));

  return app;
}
