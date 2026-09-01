import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import {
  eventConfig,
  buildIcs,
  isRsvpClosed,
  slugify,
  eventConfigFromRow,
  getDefaultEvent,
  getEventBySlug,
  getEventById,
  type EventConfig
} from './event.ts';
import { THEME_IDS, DEFAULT_THEME } from './themes.ts';
import { renderOgPng } from './og-image.ts';
import {
  buildEventMeta,
  buildRobotsTxt,
  buildSitemapXml,
  indexingAllowed,
  renderIndexHtml,
  resolveOrigin,
  FALLBACK_META
} from './seo.ts';
import { logger as defaultLogger, type Logger } from './logger.ts';
import { createAuth, isRole, ROLES, DEFAULT_ROLE, type Auth, type Role } from './auth.ts';
import type { Db, RsvpRow, EventRow } from './db.ts';

export interface CreateAppOptions {
  // Better Auth instance protecting the admin routes. When omitted one is built
  // from the app's SQLite handle (env-configured secret/baseURL).
  auth?: Auth;
  trustProxy?: number;
  rateLimits?: {
    globalWindowMs?: number;
    globalMax?: number;
    rsvpWindowMs?: number;
    rsvpMax?: number;
    lookupWindowMs?: number;
    lookupMax?: number;
    adminWindowMs?: number;
    adminMax?: number;
    loginMax?: number;
    signupWindowMs?: number;
    signupMax?: number;
  };
  event?: EventConfig;
  corsOrigin?: string;
  staticDir?: string;
  logger?: Logger;
}

// Wrap an async route handler so rejected promises reach the error middleware.
type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
const asyncHandler = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// The signed-in account as the routes need it. Better Auth returns the user row
// including our `role` additional field, which it does not type on the session.
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  role: Role;
}

// Read the session and normalise the user, or null when unauthenticated. An
// unrecognised role degrades to the least-privileged one rather than throwing.
async function currentUser(auth: Auth, req: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const user = session.user as unknown as Omit<SessionUser, 'role'> & { role?: unknown };
  return { ...user, role: isRole(user.role) ? user.role : DEFAULT_ROLE };
}

// Build the admin guard. Fails closed, and distinguishes the two failure modes
// so the SPA can tell them apart: 401 means "no session, show the sign-in
// form", 403 + code `not_admin` means "signed in, but this account has not been
// granted access" — the pending-approval screen. Registration is open, so the
// 403 case is the normal state of a brand-new account.
function makeRequireAdmin(auth: Auth) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: "Votre compte n'a pas encore accès à l'administration.",
        code: 'not_admin'
      });
    }
    // Downstream routes need the actor's identity to refuse self-demotion and
    // self-deletion; res.locals is already a per-request bag.
    res.locals.user = user;
    next();
  });
}

// Build the signed-in guard. Every registered account passes: an account owns
// the invitations it creates, so the event API is reachable without the admin
// role. Only a missing session is refused (401) — the per-event ownership check
// below decides what the account may actually touch.
function makeRequireUser(auth: Auth) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.locals.user = user;
    next();
  });
}

// --- Validation (zod) --------------------------------------------------------

const guestsMessage = (min: number) => `Le nombre d'invités doit être entre ${min} et 10`;

function rsvpSchema(opts: { requireAttending: boolean; minGuests: number }) {
  const attending = z.enum(['yes', 'no'], { error: 'Le statut de participation est requis' });
  // Bound free-text fields so a single request can't store unbounded data.
  const optionalText = (max: number) =>
    z.string().trim().max(max, `Texte trop long (max ${max} caractères)`).nullish();
  return z.object({
    attending: opts.requireAttending ? attending : attending.optional(),
    name: z
      .string({ error: 'Le nom est requis' })
      .trim()
      .min(1, 'Le nom est requis')
      .max(100, 'Le nom est trop long (max 100 caractères)'),
    phone: z
      .string({ error: 'Le numéro de téléphone est requis' })
      .trim()
      .min(1, 'Le numéro de téléphone est requis')
      .max(30, 'Numéro de téléphone invalide'),
    email: z
      .string()
      .trim()
      .max(254, 'Email trop long')
      .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Email invalide')
      .nullish(),
    guests: z
      .number()
      .int()
      .min(opts.minGuests, guestsMessage(opts.minGuests))
      .max(10, guestsMessage(opts.minGuests))
      .optional(),
    dietary_restrictions: optionalText(500),
    message: optionalText(2000)
  });
}

// Role assignment for the user-management routes.
const userRoleSchema = z.object({
  role: z.enum(ROLES, { error: 'Rôle inconnu' })
});

// Admin-selectable UI theme. Validated against the shared allow-list so the
// stored value always maps to a known frontend theme.
const settingsSchema = z.object({
  theme: z.enum(THEME_IDS, { error: 'Thème inconnu' })
});

// A date is either empty or a strict YYYY-MM-DD.
const dateRegex = /^(\d{4}-\d{2}-\d{2})?$/;
// A slug is dash-separated lowercase alphanumerics with no leading/trailing dash.
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(60, 'Lien invalide')
  .regex(slugRegex, 'Lien invalide')
  .refine((v) => v !== 'default', 'Lien invalide')
  .refine((v) => !/^[0-9]+$/.test(v), 'Lien invalide');

// Shared event field validators (used by both create and update schemas).
const eventFields = {
  age: z.string().trim().max(20, 'Texte trop long (max 20 caractères)'),
  date: z.string().trim().regex(dateRegex, 'Date invalide (YYYY-MM-DD)'),
  time: z.string().trim().max(100, 'Texte trop long (max 100 caractères)'),
  town: z.string().trim().max(120, 'Texte trop long (max 120 caractères)'),
  location: z.string().trim().max(200, 'Texte trop long (max 200 caractères)'),
  dress_code: z.string().trim().max(200, 'Texte trop long (max 200 caractères)'),
  theme: z.enum(THEME_IDS, { error: 'Thème inconnu' }),
  rsvp_deadline: z.string().trim().regex(dateRegex, 'Date invalide (YYYY-MM-DD)')
};

const personField = z
  .string({ error: 'Le nom est requis' })
  .trim()
  .min(1, 'Le nom est requis')
  .max(100, 'Le nom est trop long (max 100 caractères)');

const eventCreateSchema = z.object({
  person: personField,
  age: eventFields.age.optional().default(''),
  date: eventFields.date.optional().default(''),
  time: eventFields.time.optional().default(''),
  town: eventFields.town.optional().default(''),
  location: eventFields.location.optional().default(''),
  dress_code: eventFields.dress_code.optional().default(''),
  theme: eventFields.theme.optional().default(DEFAULT_THEME),
  rsvp_deadline: eventFields.rsvp_deadline.optional().default(''),
  slug: slugField.optional()
});

const eventUpdateSchema = z.object({
  person: personField.optional(),
  age: eventFields.age.optional(),
  date: eventFields.date.optional(),
  time: eventFields.time.optional(),
  town: eventFields.town.optional(),
  location: eventFields.location.optional(),
  dress_code: eventFields.dress_code.optional(),
  theme: eventFields.theme.optional(),
  rsvp_deadline: eventFields.rsvp_deadline.optional(),
  slug: slugField.optional()
});

// Safe event fields exposed on the public invitation route (no internal ids /
// timestamps), plus a computed `rsvp_closed` flag.
function publicEvent(row: EventRow): Record<string, unknown> {
  return {
    slug: row.slug,
    person: row.person,
    age: row.age,
    date: row.date,
    time: row.time,
    town: row.town,
    location: row.location,
    dress_code: row.dress_code,
    theme: row.theme,
    rsvp_deadline: row.rsvp_deadline,
    rsvp_closed: isRsvpClosed(eventConfigFromRow(row))
  };
}

// A row of Better Auth's `user` table, restricted to the columns the admin UI
// shows. SQLite stores emailVerified as 0/1 and the timestamps as text.
interface UserRow {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number | null;
  image: string | null;
  role: string | null;
  createdAt: string;
}

// Shape a user row for the admin UI. An unknown/NULL role reads as the default,
// matching how the session guard interprets it.
function publicUser(row: UserRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email,
    image: row.image,
    emailVerified: Boolean(row.emailVerified),
    role: isRole(row.role) ? row.role : DEFAULT_ROLE,
    created_at: row.createdAt
  };
}

// Aggregate RSVP counts for a single event.
function countRsvps(db: Db, eventId: number): {
  total_responses: number; confirmations: number; declined: number; total_guests: number;
} {
  const stats = db.get<{
    total_responses: number; confirmations: number; declined: number; total_guests: number;
  }>(`
    SELECT
      COUNT(*) AS total_responses,
      SUM(CASE WHEN attending = 'yes' THEN 1 ELSE 0 END) AS confirmations,
      SUM(CASE WHEN attending = 'no' THEN 1 ELSE 0 END) AS declined,
      SUM(CASE WHEN attending = 'yes' THEN guests ELSE 0 END) AS total_guests
    FROM rsvp WHERE event_id = ?
  `, [eventId]) ?? null;
  return {
    total_responses: stats?.total_responses || 0,
    confirmations: stats?.confirmations || 0,
    declined: stats?.declined || 0,
    total_guests: stats?.total_guests || 0
  };
}

// The slug column's length budget, mirrored by `slugField` above.
const SLUG_MAX = 60;

// Pick a free slug derived from a base, appending -2, -3… until unused.
// `excludeId` lets an update keep its own slug.
function uniqueSlug(db: Db, base: string, excludeId?: number): string {
  const taken = (slug: string): boolean => {
    const row = db.get<{ id: number }>('SELECT id FROM event WHERE slug = ?', [slug]);
    return !!row && row.id !== excludeId;
  };
  // Truncating `${base}-${n}` back to the column budget can reproduce `base`
  // itself once the base is at (or one character under) that budget — every
  // candidate then equals the slug we already know is taken, and the loop spins
  // forever, wedging the whole (single-threaded) server on one request. Trim the
  // base first so the suffix always survives the truncation.
  const withSuffix = (suffix: string): string =>
    `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;

  if (!taken(base)) return base;
  for (let n = 2; n <= 999; n++) {
    const candidate = withSuffix(`-${n}`);
    if (!taken(candidate)) return candidate;
  }
  // 998 events sharing one name is not a real deployment, but the fallback still
  // has to terminate: try a handful of random suffixes, then give up loudly
  // rather than looping.
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = withSuffix(`-${Math.random().toString(36).slice(2, 8)}`);
    if (!taken(candidate)) return candidate;
  }
  throw new Error('unable to derive a free event slug');
}

const FIELD_PRIORITY = [
  'name', 'person', 'phone', 'attending', 'guests', 'email', 'dietary_restrictions',
  'message', 'slug', 'theme', 'date', 'rsvp_deadline'
];

// Reduce a zod error to the single French message the API returns, picking the
// field that matters first (matching the original hand-rolled order).
type ZodIssue = z.ZodError['issues'][number];
function firstError(error: z.ZodError): string {
  const rank = (issue: ZodIssue) => {
    const idx = FIELD_PRIORITY.indexOf(String(issue.path[0]));
    return idx === -1 ? FIELD_PRIORITY.length : idx;
  };
  const sorted = [...error.issues].sort((a, b) => rank(a) - rank(b));
  return sorted[0]?.message ?? 'Données invalides';
}

// Normalise a phone number to digits (keeping a leading +) so the same number
// entered with different spacing/punctuation matches. "06 12-34" -> "0612 34".
function normalizePhone(raw: string): string {
  const trimmed = String(raw).trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
}

// The stored guest count for a response. A decline never carries guests — the
// invitation hides the field and the counters ignore it — so every write path
// (guest submit, admin add, admin edit) normalises it the same way instead of
// leaving a stale "1 invité" on a row switched to "Décliné".
function guestCount(attending: 'yes' | 'no', guests?: number | null): number {
  return attending === 'yes' ? (guests || 1) : 0;
}

const CSV_COLUMNS = [
  'id', 'name', 'attending', 'email', 'phone', 'guests', 'dietary_restrictions',
  'message', 'created_at', 'updated_at'
] as const;

// Render RSVP rows as a CSV document (RFC 4180 quoting).
function toCsv(rows: RsvpRow[]): string {
  const escape = (value: unknown): string => {
    if (value == null) return '';
    let str = String(value);
    // Neutralise CSV/Excel formula injection: a leading =,+,-,@,tab or CR makes
    // spreadsheets evaluate the cell. Prefix with a single quote to force text.
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((col) => escape((row as unknown as Record<string, unknown>)[col])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
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

  const app = express();

  // Behind Traefik — trust the forwarding hop(s) so req.ip is the real client.
  app.set('trust proxy', trustProxy);

  app.use(pinoHttp({
    logger,
    // The phone-lookup route carries the phone number in the URL path; mask it
    // so guest phone numbers never land in the request logs.
    serializers: {
      req(req: { url?: string }) {
        if (req.url) req.url = req.url.replace(/\/api\/rsvp\/lookup\/[^?]+/, '/api/rsvp/lookup/[redacted]');
        return req;
      }
    }
  }));
  app.use(compression());
  app.use(helmet({
    // Restrictive CSP that still allows the font/icon CDNs the SPA loads and the
    // inline styles the SPA sets. 'unsafe-inline' for styles is required by the
    // per-theme `style` attributes the invitation renders.
    //
    // umami.battistella.ovh est notre propre instance de mesure d'audience, pas
    // un tiers. Elle a besoin de DEUX directives : scriptSrc pour charger
    // stats.js et recorder.js, connectSrc pour poster la mesure. N'en ouvrir
    // qu'une donne une panne silencieuse — le script se charge et n'émet rien.
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
  }));
  // Same-origin SPA: only enable CORS when an explicit origin is configured
  // (e.g. a separate dev frontend). Defaults to no cross-origin access.
  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
  }

  // --- Better Auth (email/password + Google) ---------------------------------
  // The auth handler reads the raw request body, so it must be mounted *before*
  // express.json().
  //
  // Registration is open: anyone may sign up with an email/password (confirmed
  // by a verification email) or with Google. Signing up grants nothing — new
  // accounts get the `user` role and are refused by requireAdmin until an
  // existing admin promotes them (see PUT /api/users/:id/role).
  const loginLimiter = rateLimit({
    windowMs: rateLimits.adminWindowMs ?? 15 * 60 * 1000,
    max: rateLimits.loginMax ?? 20,
    message: { error: 'Trop de tentatives, veuillez réessayer plus tard.' }
  });
  // Every endpoint below sends an email to an address chosen by the caller, so
  // each one is a spam amplifier if left open. Throttled harder than sign-in,
  // and per-IP like the rest.
  const emailLimiter = rateLimit({
    windowMs: rateLimits.signupWindowMs ?? 60 * 60 * 1000,
    max: rateLimits.signupMax ?? 10,
    message: { error: 'Trop de tentatives, veuillez réessayer plus tard.' }
  });
  app.use('/api/auth/sign-in', loginLimiter);
  app.use('/api/auth/sign-up', emailLimiter);
  app.use('/api/auth/request-password-reset', emailLimiter);
  app.use('/api/auth/send-verification-email', emailLimiter);
  app.all('/api/auth/*splat', toNodeHandler(auth));

  app.use(express.json({ limit: '64kb' }));

  const requireAdmin = makeRequireAdmin(auth);
  const requireUser = makeRequireUser(auth);

  app.use(rateLimit({
    windowMs: rateLimits.globalWindowMs ?? 15 * 60 * 1000,
    max: rateLimits.globalMax ?? 300
  }));

  const rsvpLimiter = rateLimit({
    windowMs: rateLimits.rsvpWindowMs ?? 60 * 60 * 1000,
    max: rateLimits.rsvpMax ?? 5,
    message: { error: 'Trop de tentatives de réponse, veuillez réessayer plus tard.' }
  });

  // Strict limiter for the public phone-lookup oracle to blunt enumeration.
  const lookupLimiter = rateLimit({
    windowMs: rateLimits.lookupWindowMs ?? 60 * 60 * 1000,
    max: rateLimits.lookupMax ?? 20,
    message: { error: 'Trop de recherches, veuillez réessayer plus tard.' }
  });

  // Limiter on admin endpoints to blunt automated abuse. Sign-in itself is
  // throttled separately by loginLimiter (above).
  //
  // The dashboard polls every 30s (events + the selected event's counts and
  // RSVPs), which is ~90 requests per 15 minutes on its own — a ceiling of 100
  // meant a second open tab started getting 429s. These routes are already
  // behind an authenticated admin session, so the limiter is a backstop against
  // a runaway client rather than the primary control.
  const adminLimiter = rateLimit({
    windowMs: rateLimits.adminWindowMs ?? 15 * 60 * 1000,
    max: rateLimits.adminMax ?? 300,
    message: { error: 'Trop de tentatives, veuillez réessayer plus tard.' }
  });
  // Every admin route is rate-limited then requires a valid admin session.
  const admin = [adminLimiter, requireAdmin];
  // Event routes only need *a* session: the ownership check on each route
  // narrows an account to the invitations it created (an admin sees them all).
  const member = [adminLimiter, requireUser];

  // The default event backs the legacy single-event routes. Resolved lazily
  // per-request so it always reflects the current default row.
  const defaultEventId = () => getDefaultEvent(db).id;

  // A path parameter as a row id, or null when it isn't one. Keeps a junk id a
  // 404 rather than letting NaN reach a comparison that silently never matches.
  const rsvpIdParam = (raw: unknown): number | null => {
    const id = Number(raw);
    return Number.isInteger(id) ? id : null;
  };

  // True when another response on this event already holds the phone number, so
  // an edit can answer 409 instead of tripping the (event_id, phone) UNIQUE
  // index and falling through to the generic 500 handler.
  const phoneTaken = (eventId: number, phone: string, exceptRsvpId: number): boolean => {
    const row = db.get<{ id: number }>(
      'SELECT id FROM rsvp WHERE event_id = ? AND phone = ?',
      [eventId, phone]
    );
    return !!row && row.id !== exceptRsvpId;
  };

  // The account acting on the current request. Only ever read inside routes
  // mounted behind `admin` / `member`, both of which populate it.
  const currentActor = (res: Response): SessionUser => res.locals.user as SessionUser;

  // May this account manage this event? An admin manages every invitation,
  // including the env-seeded default one (which has no owner). Everyone else
  // manages exactly the invitations they created.
  const canManage = (user: SessionUser, row: EventRow): boolean =>
    user.role === 'admin' || (row.owner_id !== null && row.owner_id === user.id);

  // Resolve the event named by a path parameter, or answer 404 and return null.
  // Someone else's event is a 404 rather than a 403 so the API never confirms
  // which ids exist to an account that cannot see them.
  const manageableEvent = (raw: unknown, res: Response): EventRow | null => {
    const id = Number(raw);
    const row = Number.isInteger(id) ? getEventById(db, id) : undefined;
    if (!row || !canManage(currentActor(res), row)) {
      res.status(404).json({ error: 'Événement introuvable' });
      return null;
    }
    return row;
  };

  // The default event as the legacy routes read it (deadline, calendar invite).
  // The stored row wins: it is seeded from the env config at boot and is what
  // the admin UI edits afterwards, so an edited date or RSVP deadline has to
  // reach these routes too — otherwise /api/rsvp and /api/events/default/rsvp
  // disagree about whether the same event is still open. The injected config is
  // only the fallback for a default row that was never seeded.
  const defaultEventConfig = (): EventConfig => {
    const row = getDefaultEvent(db);
    return row.person ? eventConfigFromRow(row) : event;
  };

  // --- Routes ---------------------------------------------------------------

  // Health check also verifies the database is reachable/writable-ish so the
  // probe fails when SQLite is unusable, not just when the process is up.
  app.get('/api/health', asyncHandler((_req, res) => {
    const timestamp = new Date().toISOString();
    try {
      db.get('SELECT 1');
    } catch {
      return res.status(503).json({ status: 'unavailable', timestamp });
    }
    res.json({ status: 'OK', timestamp });
  }));

  // --- Accounts -------------------------------------------------------------

  // Public: which sign-in methods this deployment actually offers, so the SPA
  // only renders the Google button when the provider is configured.
  app.get('/api/auth-providers', (_req, res) => {
    res.json({
      emailPassword: true,
      google: Boolean(auth.options.socialProviders?.google)
    });
  });

  // The signed-in account, including its granted role. 401 when there is no
  // session. The SPA reads `role` to choose between the admin dashboard and the
  // pending-approval screen — it is deliberately not behind requireAdmin, since
  // a non-admin needs to be able to learn that it is a non-admin.
  app.get('/api/me', asyncHandler(async (req, res) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({
      user: {
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        image: user.image ?? null,
        emailVerified: Boolean(user.emailVerified),
        role: user.role
      }
    });
  }));

  // --- User administration --------------------------------------------------

  // How many admins remain. Guards below refuse any change that would take this
  // to zero, which would lock everyone out of the dashboard.
  const adminCount = (): number =>
    db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM "user" WHERE role = 'admin'`)?.n ?? 0;

  const getUser = (id: string) =>
    db.get<UserRow>(
      `SELECT id, name, email, emailVerified, image, role, "createdAt" FROM "user" WHERE id = ?`,
      [id]
    );

  // Admin: every registered account, so an admin can see who has signed up and
  // grant or revoke access. Password hashes live in the `account` table and are
  // never selected here.
  app.get('/api/users', ...admin, asyncHandler((_req, res) => {
    const users = db.all<UserRow>(
      `SELECT id, name, email, emailVerified, image, role, "createdAt"
       FROM "user" ORDER BY "createdAt" DESC, id DESC`
    );
    res.json({ users: users.map(publicUser) });
  }));

  // Admin: grant or revoke the admin role.
  app.put('/api/users/:id/role', ...admin, asyncHandler(async (req, res) => {
    const parsed = userRoleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const target = getUser(String(req.params.id));
    if (!target) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    const actor = res.locals.user as SessionUser;
    const { role } = parsed.data;
    if (target.id === actor.id && role !== 'admin') {
      return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre accès administrateur.' });
    }
    if (target.role === 'admin' && role !== 'admin' && adminCount() <= 1) {
      return res.status(400).json({ error: 'Il doit rester au moins un administrateur.' });
    }

    const ctx = await auth.$context;
    await ctx.internalAdapter.updateUser(target.id, { role });
    // A demoted account still holds a valid session cookie. Drop its sessions so
    // the loss of access is immediate rather than deferred to the next sign-in.
    if (role !== 'admin') {
      db.run(`DELETE FROM "session" WHERE "userId" = ?`, [target.id]);
    }
    logger.info({ actor: actor.id, target: target.id, role }, 'user role changed');
    res.json({ user: publicUser({ ...target, role }) });
  }));

  // Admin: delete an account entirely (cascades its sessions and credentials).
  // Its invitations go with it — and their RSVPs by the event_id cascade.
  // Leaving them behind would keep publicly reachable invitation pages that no
  // account can manage any more, since ownership is what grants access to them.
  app.delete('/api/users/:id', ...admin, asyncHandler(async (req, res) => {
    const target = getUser(String(req.params.id));
    if (!target) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    const actor = res.locals.user as SessionUser;
    if (target.id === actor.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    if (target.role === 'admin' && adminCount() <= 1) {
      return res.status(400).json({ error: 'Il doit rester au moins un administrateur.' });
    }

    const ctx = await auth.$context;
    // Account first: a failed deleteUser must not leave an account whose
    // invitations were already destroyed. The reverse order only risks events
    // outliving their owner, which an admin can still see and clean up.
    await ctx.internalAdapter.deleteUser(target.id);
    const events = db.run('DELETE FROM event WHERE owner_id = ?', [target.id]);
    logger.info({ actor: actor.id, target: target.id, events: events.changes }, 'user deleted');
    res.json({ message: 'Compte supprimé' });
  }));

  // Public: the current UI settings (currently just the selected theme).
  // The theme now lives on the default event row; defaults to fiesta (the
  // column default) when never chosen.
  app.get('/api/settings', asyncHandler((_req, res) => {
    res.json({ theme: getDefaultEvent(db).theme });
  }));

  // Admin: choose the active UI theme. Validated against the shared allow-list.
  app.put('/api/settings', ...admin, asyncHandler((req, res) => {
    const parsed = settingsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    db.run('UPDATE event SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      parsed.data.theme,
      defaultEventId()
    ]);
    res.json({ theme: parsed.data.theme });
  }));

  app.get('/api/rsvps', ...admin, asyncHandler((_req, res) => {
    const rsvps = db.all<RsvpRow>(
      'SELECT * FROM rsvp WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      [defaultEventId()]
    );
    res.json({ rsvps });
  }));

  app.get('/api/rsvps/count', ...admin, asyncHandler((_req, res) => {
    res.json(countRsvps(db, defaultEventId()));
  }));

  // Export every RSVP as CSV (admin). UTF-8 BOM so spreadsheets render accents.
  app.get('/api/rsvps/export.csv', ...admin, asyncHandler((_req, res) => {
    const rows = db.all<RsvpRow>(
      'SELECT * FROM rsvp WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      [defaultEventId()]
    );
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="rsvps.csv"');
    res.send('﻿' + toCsv(rows));
  }));

  // Calendar invite (guest) generated from the event configuration.
  app.get('/api/event.ics', (_req, res) => {
    const ics = buildIcs(defaultEventConfig());
    if (!ics) {
      return res.status(404).json({ error: 'Aucune date d\'événement configurée' });
    }
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="invitation.ics"');
    res.send(ics);
  });

  // Look up an existing RSVP so a guest can pre-fill / edit their response.
  // Rate-limited to blunt phone-number enumeration, and returns only the fields
  // the form needs — never the stored ip_address or internal timestamps.
  app.get('/api/rsvp/lookup/:phone', lookupLimiter, asyncHandler((req, res) => {
    const phone = normalizePhone(String(req.params.phone ?? ''));
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    const row = db.get<RsvpRow>(
      `SELECT id, attending, name, email, phone, guests, dietary_restrictions, message
       FROM rsvp WHERE event_id = ? AND phone = ? ORDER BY created_at DESC LIMIT 1`,
      [defaultEventId(), phone]
    );
    if (!row) {
      return res.status(404).json({ error: 'Aucune réponse trouvée pour ce numéro de téléphone' });
    }
    res.json(row);
  }));

  // Submit (or update) an RSVP. Phone is the guest identity: one per phone.
  app.post('/api/rsvp', rsvpLimiter, asyncHandler((req, res) => {
    if (isRsvpClosed(defaultEventConfig())) {
      return res.status(403).json({ error: 'Les réponses sont closes pour cet événement.' });
    }
    const parsed = rsvpSchema({ requireAttending: true, minGuests: 1 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;
    const ipAddress = req.ip ?? null;

    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    const attending = body.attending as 'yes' | 'no';
    const guests = guestCount(attending, body.guests);
    const email = body.email ? body.email : null;
    const message = body.message ? body.message : null;
    const dietary = body.dietary_restrictions ? body.dietary_restrictions : null;

    const eventId = defaultEventId();
    const existing = db.get<{ id: number }>(
      'SELECT id FROM rsvp WHERE event_id = ? AND phone = ?',
      [eventId, phone]
    );

    if (existing) {
      db.run(`
        UPDATE rsvp
        SET attending = ?, name = ?, email = ?, guests = ?, dietary_restrictions = ?,
            message = ?, ip_address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [attending, body.name, email, guests, dietary, message, ipAddress, existing.id]);
      return res.json({ message: 'Réponse mise à jour avec succès !', id: existing.id });
    }

    const result = db.run(`
      INSERT INTO rsvp (event_id, attending, name, email, phone, guests, dietary_restrictions, message, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [eventId, attending, body.name, email, phone, guests, dietary, message, ipAddress]);

    res.status(201).json({ message: 'Réponse soumise avec succès !', id: Number(result.lastID) });
  }));

  // Create an RSVP manually (admin) — e.g. replies received by phone/in person.
  // Not rate-limited like the public endpoint; one row per phone still applies.
  app.post('/api/rsvps', ...admin, asyncHandler((req, res) => {
    const parsed = rsvpSchema({ requireAttending: true, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    const eventId = defaultEventId();
    if (db.get<{ id: number }>('SELECT id FROM rsvp WHERE event_id = ? AND phone = ?', [eventId, phone])) {
      return res.status(409).json({ error: 'Une réponse existe déjà pour ce numéro' });
    }
    const attending = body.attending as 'yes' | 'no';
    const guests = guestCount(attending, body.guests);
    const result = db.run(`
      INSERT INTO rsvp (event_id, attending, name, email, phone, guests, dietary_restrictions, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eventId,
      attending,
      body.name,
      body.email ? body.email : null,
      phone,
      guests,
      body.dietary_restrictions ? body.dietary_restrictions : null,
      body.message ? body.message : null
    ]);
    res.status(201).json({ message: 'RSVP ajouté avec succès !', id: Number(result.lastID) });
  }));

  // Update an RSVP of the default event (admin). Scoped like every other legacy
  // route: an id belonging to another event is a 404 here, not a silent
  // cross-event write.
  app.put('/api/rsvp/:id', ...admin, asyncHandler((req, res) => {
    const parsed = rsvpSchema({ requireAttending: false, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const rsvpId = rsvpIdParam(req.params.id);
    if (rsvpId === null) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    const body = parsed.data;
    const attending = body.attending ?? 'yes';
    const eventId = defaultEventId();
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    // Phone is the guest identity, and (event_id, phone) is a UNIQUE index:
    // moving a response onto a number another guest already used would raise a
    // constraint error and surface as an opaque 500. Answer like the create
    // route does instead.
    if (phoneTaken(eventId, phone, rsvpId)) {
      return res.status(409).json({ error: 'Une réponse existe déjà pour ce numéro' });
    }

    const result = db.run(`
      UPDATE rsvp
      SET attending = ?, name = ?, email = ?, phone = ?, guests = ?,
          dietary_restrictions = ?, message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND event_id = ?
    `, [
      attending,
      body.name,
      body.email ? body.email : null,
      phone,
      guestCount(attending, body.guests),
      body.dietary_restrictions ? body.dietary_restrictions : null,
      body.message ? body.message : null,
      rsvpId,
      eventId
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP mis à jour avec succès !', changes: result.changes });
  }));

  // Delete an RSVP of the default event (admin).
  app.delete('/api/rsvp/:id', ...admin, asyncHandler((req, res) => {
    const result = db.run('DELETE FROM rsvp WHERE id = ? AND event_id = ?', [
      req.params.id,
      defaultEventId()
    ]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP supprimé avec succès !', changes: result.changes });
  }));

  // --- Event management -----------------------------------------------------
  // Every signed-in account may run as many invitations as it likes: creating
  // one stamps it with the creator's id, and each route below is scoped to the
  // invitations the account owns. An admin keeps the deployment-wide view —
  // every event, the ownerless default one included.
  //
  // Listed before the public GET /api/events/:slug so the param route can't
  // shadow this exact path. (Express distinguishes them anyway by segment
  // count, but keep the declaration order explicit.)

  // The account's own events with aggregated RSVP counts; every event for an
  // admin.
  app.get('/api/events', ...member, asyncHandler((_req, res) => {
    const user = currentActor(res);
    const mine = user.role !== 'admin';
    const events = db.all<EventRow & {
      responses: number; confirmations: number; declined: number; total_guests: number;
    }>(`
      SELECT e.*,
        (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id) AS responses,
        (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'yes') AS confirmations,
        (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'no') AS declined,
        (SELECT COALESCE(SUM(r.guests), 0) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'yes') AS total_guests
      FROM event e
      ${mine ? 'WHERE e.owner_id = ?' : ''}
      ORDER BY e.is_default DESC, e.created_at DESC, e.id DESC
    `, mine ? [user.id] : []);
    res.json({ events });
  }));

  // Create an event. Slug derives from the person's name when not provided and
  // is made unique by appending -2, -3… An explicitly-provided taken slug 409s.
  app.post('/api/events', ...member, asyncHandler((req, res) => {
    const parsed = eventCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const data = parsed.data;

    let slug: string;
    if (data.slug) {
      if (db.get<{ id: number }>('SELECT id FROM event WHERE slug = ?', [data.slug])) {
        return res.status(409).json({ error: 'Ce lien est déjà utilisé' });
      }
      slug = data.slug;
    } else {
      slug = uniqueSlug(db, slugify(data.person));
    }

    // The creator owns the invitation, which is what lets one account run
    // several of them and see only its own on the routes above and below.
    const result = db.run(`
      INSERT INTO event (slug, person, age, date, time, town, location, dress_code, theme, rsvp_deadline, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slug, data.person, data.age, data.date, data.time, data.town,
      data.location, data.dress_code, data.theme, data.rsvp_deadline, currentActor(res).id
    ]);
    const created = getEventById(db, Number(result.lastID));
    res.status(201).json(created);
  }));

  // Update an event (partial). The default event's slug is fixed; other events
  // can change slug but must stay unique. is_default is never editable.
  app.put('/api/events/:id', ...member, asyncHandler((req, res) => {
    const existing = manageableEvent(req.params.id, res);
    if (!existing) return;
    const id = existing.id;
    const parsed = eventUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const data = parsed.data;

    // Resolve the slug to store: the default event keeps 'default'; others may
    // change it but must remain unique (409 on a collision with another event).
    let slug = existing.slug;
    if (data.slug !== undefined && !existing.is_default && data.slug !== existing.slug) {
      const clash = db.get<{ id: number }>('SELECT id FROM event WHERE slug = ?', [data.slug]);
      if (clash && clash.id !== id) {
        return res.status(409).json({ error: 'Ce lien est déjà utilisé' });
      }
      slug = data.slug;
    }

    const next = {
      slug,
      person: data.person ?? existing.person,
      age: data.age ?? existing.age,
      date: data.date ?? existing.date,
      time: data.time ?? existing.time,
      town: data.town ?? existing.town,
      location: data.location ?? existing.location,
      dress_code: data.dress_code ?? existing.dress_code,
      theme: data.theme ?? existing.theme,
      rsvp_deadline: data.rsvp_deadline ?? existing.rsvp_deadline
    };

    db.run(`
      UPDATE event
      SET slug = ?, person = ?, age = ?, date = ?, time = ?, town = ?, location = ?,
          dress_code = ?, theme = ?, rsvp_deadline = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      next.slug, next.person, next.age, next.date, next.time, next.town,
      next.location, next.dress_code, next.theme, next.rsvp_deadline, id
    ]);
    res.json(getEventById(db, id));
  }));

  // Delete an event (its RSVPs cascade). The default event cannot be removed.
  app.delete('/api/events/:id', ...member, asyncHandler((req, res) => {
    const existing = manageableEvent(req.params.id, res);
    if (!existing) return;
    const id = existing.id;
    if (existing.is_default) {
      return res.status(400).json({ error: 'Impossible de supprimer l\'événement par défaut' });
    }
    const result = db.run('DELETE FROM event WHERE id = ?', [id]);
    res.json({ message: 'Événement supprimé', changes: result.changes });
  }));

  // --- Per-event RSVP sub-routes (owner or admin) ---------------------------

  // Resolve the numeric event id from the path, or send a 404. Returns null
  // when the param isn't an event this account manages, so callers can
  // early-return.
  const resolveEventId = (raw: string, res: Response): number | null =>
    manageableEvent(raw, res)?.id ?? null;

  app.get('/api/events/:id/rsvps', ...member, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const rsvps = db.all<RsvpRow>(
      'SELECT * FROM rsvp WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      [id]
    );
    res.json({ rsvps });
  }));

  app.get('/api/events/:id/rsvps/count', ...member, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    res.json(countRsvps(db, id));
  }));

  app.get('/api/events/:id/rsvps/export.csv', ...member, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const event = getEventById(db, id) as EventRow;
    const rows = db.all<RsvpRow>(
      'SELECT * FROM rsvp WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      [id]
    );
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="rsvps-${event.slug}.csv"`);
    res.send('﻿' + toCsv(rows));
  }));

  app.post('/api/events/:id/rsvps', ...member, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const parsed = rsvpSchema({ requireAttending: true, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    if (db.get<{ id: number }>('SELECT id FROM rsvp WHERE event_id = ? AND phone = ?', [id, phone])) {
      return res.status(409).json({ error: 'Une réponse existe déjà pour ce numéro' });
    }
    const attending = body.attending as 'yes' | 'no';
    const guests = guestCount(attending, body.guests);
    const result = db.run(`
      INSERT INTO rsvp (event_id, attending, name, email, phone, guests, dietary_restrictions, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      attending,
      body.name,
      body.email ? body.email : null,
      phone,
      guests,
      body.dietary_restrictions ? body.dietary_restrictions : null,
      body.message ? body.message : null
    ]);
    res.status(201).json({ message: 'RSVP ajouté avec succès !', id: Number(result.lastID) });
  }));

  app.put('/api/events/:id/rsvp/:rsvpId', ...member, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const parsed = rsvpSchema({ requireAttending: false, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const rsvpId = rsvpIdParam(req.params.rsvpId);
    if (rsvpId === null) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    const body = parsed.data;
    const attending = body.attending ?? 'yes';
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    // (event_id, phone) is UNIQUE — see the legacy edit route above.
    if (phoneTaken(id, phone, rsvpId)) {
      return res.status(409).json({ error: 'Une réponse existe déjà pour ce numéro' });
    }
    const result = db.run(`
      UPDATE rsvp
      SET attending = ?, name = ?, email = ?, phone = ?, guests = ?,
          dietary_restrictions = ?, message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND event_id = ?
    `, [
      attending,
      body.name,
      body.email ? body.email : null,
      phone,
      guestCount(attending, body.guests),
      body.dietary_restrictions ? body.dietary_restrictions : null,
      body.message ? body.message : null,
      rsvpId,
      id
    ]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP mis à jour avec succès !', changes: result.changes });
  }));

  app.delete('/api/events/:id/rsvp/:rsvpId', ...member, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const result = db.run('DELETE FROM rsvp WHERE id = ? AND event_id = ?', [req.params.rsvpId, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP supprimé avec succès !', changes: result.changes });
  }));

  // --- Public event-scoped routes -------------------------------------------

  // Public invitation payload (safe fields only) + computed rsvp_closed.
  app.get('/api/events/:slug', asyncHandler((req, res) => {
    const row = getEventBySlug(db, String(req.params.slug));
    if (!row) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    res.json(publicEvent(row));
  }));

  // Submit (or update) an RSVP scoped to this event. One row per (event, phone).
  app.post('/api/events/:slug/rsvp', rsvpLimiter, asyncHandler((req, res) => {
    const row = getEventBySlug(db, String(req.params.slug));
    if (!row) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    if (isRsvpClosed(eventConfigFromRow(row))) {
      return res.status(403).json({ error: 'Les réponses sont closes pour cet événement.' });
    }
    const parsed = rsvpSchema({ requireAttending: true, minGuests: 1 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;
    const ipAddress = req.ip ?? null;

    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    const attending = body.attending as 'yes' | 'no';
    const guests = guestCount(attending, body.guests);
    const email = body.email ? body.email : null;
    const message = body.message ? body.message : null;
    const dietary = body.dietary_restrictions ? body.dietary_restrictions : null;

    const existing = db.get<{ id: number }>(
      'SELECT id FROM rsvp WHERE event_id = ? AND phone = ?',
      [row.id, phone]
    );
    if (existing) {
      db.run(`
        UPDATE rsvp
        SET attending = ?, name = ?, email = ?, guests = ?, dietary_restrictions = ?,
            message = ?, ip_address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [attending, body.name, email, guests, dietary, message, ipAddress, existing.id]);
      return res.json({ message: 'Réponse mise à jour avec succès !', id: existing.id });
    }

    const result = db.run(`
      INSERT INTO rsvp (event_id, attending, name, email, phone, guests, dietary_restrictions, message, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [row.id, attending, body.name, email, phone, guests, dietary, message, ipAddress]);
    res.status(201).json({ message: 'Réponse soumise avec succès !', id: Number(result.lastID) });
  }));

  // Look up a guest's existing RSVP for this event (rate-limited).
  app.get('/api/events/:slug/rsvp/lookup/:phone', lookupLimiter, asyncHandler((req, res) => {
    const row = getEventBySlug(db, String(req.params.slug));
    if (!row) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    const phone = normalizePhone(String(req.params.phone ?? ''));
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    const rsvp = db.get<RsvpRow>(
      `SELECT id, attending, name, email, phone, guests, dietary_restrictions, message
       FROM rsvp WHERE event_id = ? AND phone = ? ORDER BY created_at DESC LIMIT 1`,
      [row.id, phone]
    );
    if (!rsvp) {
      return res.status(404).json({ error: 'Aucune réponse trouvée pour ce numéro de téléphone' });
    }
    res.json(rsvp);
  }));

  // --- Open Graph share card -------------------------------------------------
  // Rasterising costs ~50 ms, and a link pasted into a group chat is fetched by
  // every scraper at once, so keep the rendered bytes around. The key carries
  // updated_at, so an admin's edit invalidates the entry by itself.
  const ogCache = new Map<string, Buffer>();
  const OG_CACHE_MAX = 32;

  const sendOgPng = (row: EventRow, req: Request, res: Response): void => {
    const key = `${row.id}:${row.updated_at}:${row.theme}`;
    let png = ogCache.get(key);
    if (!png) {
      png = renderOgPng(row);
      // Bound the cache: drop the oldest entry once it is full (Map keeps
      // insertion order), so a deployment with many events can't grow it freely.
      if (ogCache.size >= OG_CACHE_MAX) {
        const oldest = ogCache.keys().next().value;
        if (oldest !== undefined) ogCache.delete(oldest);
      }
      ogCache.set(key, png);
    }
    const etag = `W/"og-${key}"`;
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.send(png);
  };

  app.get('/api/events/:slug/og.png', asyncHandler((req, res) => {
    const row = getEventBySlug(db, String(req.params.slug));
    if (!row) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    sendOgPng(row, req, res);
  }));

  // Legacy un-slugged route: the share card of the default event.
  app.get('/api/og.png', asyncHandler((req, res) => {
    sendOgPng(getDefaultEvent(db), req, res);
  }));

  // Calendar invite for a specific event.
  app.get('/api/events/:slug/event.ics', asyncHandler((req, res) => {
    const row = getEventBySlug(db, String(req.params.slug));
    if (!row) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    const ics = buildIcs(eventConfigFromRow(row));
    if (!ics) {
      return res.status(404).json({ error: 'Aucune date d\'événement configurée' });
    }
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="invitation.ics"');
    res.send(ics);
  }));

  // Unmatched API routes get a JSON 404 (not Express's default HTML page).
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ressource introuvable' });
  });

  // --- Static SPA -----------------------------------------------------------
  if (staticDir) {
    const indexPath = path.join(staticDir, 'index.html');
    // The built shell never changes for the life of the process, so read it once
    // and only re-render the <head> per request.
    let indexTemplate: string | null = null;
    const readIndexTemplate = (): string => {
      if (indexTemplate === null) indexTemplate = fs.readFileSync(indexPath, 'utf8');
      return indexTemplate;
    };

    // Which event (if any) a given SPA path shows: "/" is the default event,
    // "/e/<slug>" a named one. Anything else (e.g. /admin) has no event.
    const eventForPath = (pathname: string): EventRow | undefined => {
      if (pathname === '/' || pathname === '/index.html') return getDefaultEvent(db);
      const match = /^\/e\/([^/]+)\/?$/.exec(pathname);
      return match ? getEventBySlug(db, decodeURIComponent(match[1])) : undefined;
    };

    // Crawler directives. Registered before express.static so these win over any
    // file of the same name shipped in the build (the dev server keeps one).
    app.get('/robots.txt', (req, res) => {
      res.type('text/plain').send(buildRobotsTxt(resolveOrigin(req), indexingAllowed()));
    });

    app.get('/sitemap.xml', (req, res) => {
      const origin = resolveOrigin(req);
      if (!origin || !indexingAllowed()) return res.status(404).type('text/plain').send('Not found');
      const rows = db.all<EventRow>('SELECT * FROM event ORDER BY is_default DESC, id');
      res.type('application/xml').send(buildSitemapXml(rows, origin));
    });

    // express.static would serve /index.html raw — no metadata, and a duplicate
    // of "/". Send it to the canonical URL instead.
    app.get('/index.html', (_req, res) => res.redirect(301, '/'));

    app.use(express.static(staticDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));

    // SPA fallback. Link scrapers and crawlers never run our JavaScript, so the
    // shell they get must already describe the event they asked for.
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) {
        return next();
      }
      let html: string;
      try {
        html = readIndexTemplate();
      } catch {
        return next();
      }
      const row = eventForPath(req.path);
      const meta = row
        ? buildEventMeta(row, resolveOrigin(req), indexingAllowed())
        : FALLBACK_META;
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(renderIndexHtml(html, meta));
    });
  }

  // --- Error handling -------------------------------------------------------
  app.use((err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
      (req.log ?? logger).error({ err }, 'request failed');
    }
    res.status(status).json({ error: 'Une erreur s\'est produite !' });
  });

  return app;
}
