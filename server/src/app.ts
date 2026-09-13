// Composition root.
//
// This module owns one job: decide which concrete pieces the application runs
// with, wire them together and mount the routers in order. Every rule it used
// to hold inline now lives with the concern it belongs to — validation in
// http/validation.ts, authorisation in domain/access.ts, storage in
// repositories/, use-cases in services/, transport in routes/. Adding a
// resource means adding a router, not editing this file's middle.

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
  // Better Auth instance protecting the admin routes. When omitted one is built
  // from the app's SQLite handle (env-configured secret/baseURL).
  auth?: Auth;
  trustProxy?: number;
  rateLimits?: RateLimitOptions;
  event?: EventConfig;
  corsOrigin?: string;
  staticDir?: string;
  logger?: Logger;
}

/**
 * Build the Express application around an (already initialised) database.
 * A pure factory (no listener, no process state) so tests can exercise the real
 * routes against an in-memory database.
 */
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

  // --- Wiring ---------------------------------------------------------------
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

  // --- Middleware -----------------------------------------------------------
  // Behind Traefik — trust the forwarding hop(s) so req.ip is the real client.
  app.set('trust proxy', trustProxy);
  app.use(requestLogger(logger));
  app.use(compression());
  app.use(securityHeaders());
  if (corsOrigin) app.use(crossOrigin(corsOrigin));

  // --- Better Auth (email/password + Google) --------------------------------
  // The auth handler reads the raw request body, so it must be mounted *before*
  // express.json().
  //
  // Registration is open: anyone may sign up with an email/password (confirmed
  // by a verification email) or with Google. Signing up grants nothing — new
  // accounts get the `user` role and are refused by requireAdmin until an
  // existing admin promotes them (see PUT /api/users/:id/role).
  //
  // Every throttled endpoint below sends an email to an address chosen by the
  // caller, so each one is a spam amplifier if left open.
  app.use('/api/auth/sign-in', limiters.login);
  app.use('/api/auth/sign-up', limiters.email);
  app.use('/api/auth/request-password-reset', limiters.email);
  app.use('/api/auth/send-verification-email', limiters.email);
  app.all('/api/auth/*splat', toNodeHandler(auth));

  app.use(express.json({ limit: '64kb' }));
  app.use(limiters.global);

  // --- Routes ---------------------------------------------------------------
  app.use(createHealthRoutes({ checkDatabase: () => void db.get('SELECT 1') }));
  app.use(createAccountRoutes(deps));
  app.use(createUserRoutes(deps));
  app.use(createSettingsRoutes(deps));
  app.use(createDefaultEventRoutes(deps));
  app.use(createEventRoutes(deps));
  app.use(createPublicEventRoutes(deps));

  // Unmatched API routes get a JSON 404 (not Express's default HTML page).
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ressource introuvable' });
  });

  // --- Static SPA -----------------------------------------------------------
  if (staticDir) {
    app.use(createSpaRoutes({ staticDir, events: deps.events, eventRows: repos.events }));
  }

  app.use(createErrorHandler(logger));

  return app;
}
