import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import path from 'node:path';
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
import { logger as defaultLogger, type Logger } from './logger.ts';
import { createAuth, type Auth } from './auth.ts';
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

// Build the admin guard: a valid Better Auth session (email/password) is
// required. Fails closed with 401 when no session is present.
function makeRequireAuth(auth: Auth) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }
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

// Pick a free slug derived from a base, appending -2, -3… until unused.
// `excludeId` lets an update keep its own slug.
function uniqueSlug(db: Db, base: string, excludeId?: number): string {
  const taken = (slug: string): boolean => {
    const row = db.get<{ id: number }>('SELECT id FROM event WHERE slug = ?', [slug]);
    return !!row && row.id !== excludeId;
  };
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`.slice(0, 60).replace(/-+$/g, '');
    if (!taken(candidate)) return candidate;
  }
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
    // inline styles Vue injects. 'unsafe-inline' for styles is required by Vue's
    // scoped-style injection; scripts stay locked to same-origin.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
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

  // --- Better Auth (email/password) -----------------------------------------
  // The auth handler reads the raw request body, so it must be mounted *before*
  // express.json(). Public self-service registration is disabled: only the
  // env-seeded admin account exists, so the sign-up endpoint is blocked here
  // (the seed runs in-process and never touches this HTTP route).
  const loginLimiter = rateLimit({
    windowMs: rateLimits.adminWindowMs ?? 15 * 60 * 1000,
    max: rateLimits.loginMax ?? 20,
    message: { error: 'Trop de tentatives, veuillez réessayer plus tard.' }
  });
  app.all('/api/auth/sign-up/*splat', (_req, res) => {
    res.status(403).json({ error: 'Inscription désactivée' });
  });
  app.use('/api/auth/sign-in', loginLimiter);
  app.all('/api/auth/*splat', toNodeHandler(auth));

  app.use(express.json({ limit: '64kb' }));

  const requireAuth = makeRequireAuth(auth);

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

  // Strict limiter on admin endpoints to blunt automated abuse. Sign-in itself
  // is throttled separately by loginLimiter (above).
  const adminLimiter = rateLimit({
    windowMs: rateLimits.adminWindowMs ?? 15 * 60 * 1000,
    max: rateLimits.adminMax ?? 100,
    message: { error: 'Trop de tentatives, veuillez réessayer plus tard.' }
  });
  // Every admin route is rate-limited then requires a valid admin session.
  const admin = [adminLimiter, requireAuth];

  // The default event backs the legacy single-event routes. Resolved lazily
  // per-request so it always reflects the current default row.
  const defaultEventId = () => getDefaultEvent(db).id;

  // --- Routes ---------------------------------------------------------------

  // Health check also verifies the database is reachable/writable-ish so the
  // probe fails when SQLite is unusable, not just when the process is up.
  app.get('/api/health', asyncHandler((_req, res) => {
    try {
      db.get('SELECT 1');
    } catch {
      return res.status(503).json({ status: 'unavailable', timestamp: new Date().toISOString() });
    }
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
    const ics = buildIcs(event);
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
    if (isRsvpClosed(event)) {
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
    const guests = attending === 'yes' ? (body.guests || 1) : 0;
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
    const guests = attending === 'yes' ? (body.guests || 1) : 0;
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

  // Update an arbitrary RSVP (admin).
  app.put('/api/rsvp/:id', ...admin, asyncHandler((req, res) => {
    const parsed = rsvpSchema({ requireAttending: false, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;

    const result = db.run(`
      UPDATE rsvp
      SET attending = ?, name = ?, email = ?, phone = ?, guests = ?,
          dietary_restrictions = ?, message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      body.attending ?? 'yes',
      body.name,
      body.email ? body.email : null,
      normalizePhone(body.phone),
      body.guests ?? 1,
      body.dietary_restrictions ? body.dietary_restrictions : null,
      body.message ? body.message : null,
      req.params.id
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP mis à jour avec succès !', changes: result.changes });
  }));

  // Delete an RSVP (admin).
  app.delete('/api/rsvp/:id', ...admin, asyncHandler((req, res) => {
    const result = db.run('DELETE FROM rsvp WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP supprimé avec succès !', changes: result.changes });
  }));

  // --- Event-management (admin) ---------------------------------------------
  // Listed before the public GET /api/events/:slug so the param route can't
  // shadow this exact path. (Express distinguishes them anyway by segment
  // count, but keep the declaration order explicit.)

  // List every event with aggregated RSVP counts.
  app.get('/api/events', ...admin, asyncHandler((_req, res) => {
    const events = db.all<EventRow & {
      responses: number; confirmations: number; declined: number; total_guests: number;
    }>(`
      SELECT e.*,
        (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id) AS responses,
        (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'yes') AS confirmations,
        (SELECT COUNT(*) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'no') AS declined,
        (SELECT COALESCE(SUM(r.guests), 0) FROM rsvp r WHERE r.event_id = e.id AND r.attending = 'yes') AS total_guests
      FROM event e
      ORDER BY e.is_default DESC, e.created_at DESC, e.id DESC
    `);
    res.json({ events });
  }));

  // Create an event. Slug derives from the person's name when not provided and
  // is made unique by appending -2, -3… An explicitly-provided taken slug 409s.
  app.post('/api/events', ...admin, asyncHandler((req, res) => {
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

    const result = db.run(`
      INSERT INTO event (slug, person, age, date, time, town, location, dress_code, theme, rsvp_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slug, data.person, data.age, data.date, data.time, data.town,
      data.location, data.dress_code, data.theme, data.rsvp_deadline
    ]);
    const created = getEventById(db, Number(result.lastID));
    res.status(201).json(created);
  }));

  // Update an event (partial). The default event's slug is fixed; other events
  // can change slug but must stay unique. is_default is never editable.
  app.put('/api/events/:id', ...admin, asyncHandler((req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    const existing = getEventById(db, id);
    if (!existing) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
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
  app.delete('/api/events/:id', ...admin, asyncHandler((req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    const existing = getEventById(db, id);
    if (!existing) {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    if (existing.is_default) {
      return res.status(400).json({ error: 'Impossible de supprimer l\'événement par défaut' });
    }
    const result = db.run('DELETE FROM event WHERE id = ?', [id]);
    res.json({ message: 'Événement supprimé', changes: result.changes });
  }));

  // --- Per-event admin RSVP sub-routes --------------------------------------

  // Resolve the numeric event id from the path, or send a 404. Returns null
  // when the param isn't a known event so callers can early-return.
  const resolveEventId = (raw: string, res: Response): number | null => {
    const id = Number(raw);
    if (!Number.isInteger(id) || !getEventById(db, id)) {
      res.status(404).json({ error: 'Événement introuvable' });
      return null;
    }
    return id;
  };

  app.get('/api/events/:id/rsvps', ...admin, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const rsvps = db.all<RsvpRow>(
      'SELECT * FROM rsvp WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      [id]
    );
    res.json({ rsvps });
  }));

  app.get('/api/events/:id/rsvps/count', ...admin, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    res.json(countRsvps(db, id));
  }));

  app.get('/api/events/:id/rsvps/export.csv', ...admin, asyncHandler((req, res) => {
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

  app.post('/api/events/:id/rsvps', ...admin, asyncHandler((req, res) => {
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
    const guests = attending === 'yes' ? (body.guests || 1) : 0;
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

  app.put('/api/events/:id/rsvp/:rsvpId', ...admin, asyncHandler((req, res) => {
    const id = resolveEventId(String(req.params.id), res);
    if (id === null) return;
    const parsed = rsvpSchema({ requireAttending: false, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;
    const result = db.run(`
      UPDATE rsvp
      SET attending = ?, name = ?, email = ?, phone = ?, guests = ?,
          dietary_restrictions = ?, message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND event_id = ?
    `, [
      body.attending ?? 'yes',
      body.name,
      body.email ? body.email : null,
      normalizePhone(body.phone),
      body.guests ?? 1,
      body.dietary_restrictions ? body.dietary_restrictions : null,
      body.message ? body.message : null,
      req.params.rsvpId,
      id
    ]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP mis à jour avec succès !', changes: result.changes });
  }));

  app.delete('/api/events/:id/rsvp/:rsvpId', ...admin, asyncHandler((req, res) => {
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
    const guests = attending === 'yes' ? (body.guests || 1) : 0;
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
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
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
