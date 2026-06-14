import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import path from 'node:path';
import { z } from 'zod';
import { eventConfig, buildIcs, type EventConfig } from './event.ts';
import { logger as defaultLogger, type Logger } from './logger.ts';
import type { Db, RsvpRow } from './db.ts';

export interface CreateAppOptions {
  adminUsername?: string;
  adminPassword?: string;
  trustProxy?: number;
  rateLimits?: {
    globalWindowMs?: number;
    globalMax?: number;
    rsvpWindowMs?: number;
    rsvpMax?: number;
  };
  event?: EventConfig;
  staticDir?: string;
  logger?: Logger;
}

// Wrap an async route handler so rejected promises reach the error middleware.
type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
const asyncHandler = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Build a Basic-Auth middleware. Fails closed (503) when credentials are unset.
function makeBasicAuth({ username, password }: { username?: string; password?: string }) {
  return function basicAuth(req: Request, res: Response, next: NextFunction) {
    if (!username || !password) {
      return res.status(503).json({ error: 'Admin access is not configured' });
    }

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (user === username && pass === password) {
      return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
    return res.status(401).json({ error: 'Invalid credentials' });
  };
}

// --- Validation (zod) --------------------------------------------------------

const guestsMessage = (min: number) => `Le nombre d'invités doit être entre ${min} et 10`;

function rsvpSchema(opts: { requireAttending: boolean; minGuests: number }) {
  const attending = z.enum(['yes', 'no'], { error: 'Le statut de participation est requis' });
  return z.object({
    attending: opts.requireAttending ? attending : attending.optional(),
    name: z.string({ error: 'Le nom est requis' }).trim().min(1, 'Le nom est requis'),
    phone: z
      .string({ error: 'Le numéro de téléphone est requis' })
      .trim()
      .min(1, 'Le numéro de téléphone est requis'),
    email: z.string().trim().nullish(),
    guests: z
      .number()
      .int()
      .min(opts.minGuests, guestsMessage(opts.minGuests))
      .max(10, guestsMessage(opts.minGuests))
      .optional(),
    message: z.string().trim().nullish()
  });
}

const FIELD_PRIORITY = ['name', 'phone', 'attending', 'guests', 'email', 'message'];

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
  'id', 'name', 'attending', 'email', 'phone', 'guests', 'message', 'created_at', 'updated_at'
] as const;

// Render RSVP rows as a CSV document (RFC 4180 quoting).
function toCsv(rows: RsvpRow[]): string {
  const escape = (value: unknown): string => {
    if (value == null) return '';
    const str = String(value);
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
    adminUsername = process.env.ADMIN_USERNAME,
    adminPassword = process.env.ADMIN_PASSWORD,
    trustProxy = Number(process.env.TRUST_PROXY ?? 1),
    rateLimits = {},
    event = eventConfig(),
    staticDir = process.env.STATIC_DIR,
    logger = defaultLogger
  } = options;

  const app = express();

  // Behind Traefik — trust the forwarding hop(s) so req.ip is the real client.
  app.set('trust proxy', trustProxy);

  app.use(pinoHttp({ logger }));
  app.use(compression());
  app.use(helmet({
    // The SPA pulls fonts/icons from CDNs; relax CSP so it renders when this
    // process serves the HTML directly. Other Helmet defaults stay on.
    contentSecurityPolicy: false
  }));
  app.use(cors());
  app.use(express.json());

  const basicAuth = makeBasicAuth({ username: adminUsername, password: adminPassword });

  app.use(rateLimit({
    windowMs: rateLimits.globalWindowMs ?? 15 * 60 * 1000,
    max: rateLimits.globalMax ?? 100
  }));

  const rsvpLimiter = rateLimit({
    windowMs: rateLimits.rsvpWindowMs ?? 60 * 60 * 1000,
    max: rateLimits.rsvpMax ?? 5,
    message: { error: 'Trop de tentatives de réponse, veuillez réessayer plus tard.' }
  });

  // --- Routes ---------------------------------------------------------------

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.get('/api/rsvps', basicAuth, asyncHandler((_req, res) => {
    const rsvps = db.all<RsvpRow>('SELECT * FROM rsvp ORDER BY created_at DESC, id DESC');
    res.json({ rsvps });
  }));

  app.get('/api/rsvps/count', basicAuth, asyncHandler((_req, res) => {
    const stats = db.get<{
      total_responses: number; confirmations: number; declined: number; total_guests: number;
    }>(`
      SELECT
        COUNT(*) AS total_responses,
        SUM(CASE WHEN attending = 'yes' THEN 1 ELSE 0 END) AS confirmations,
        SUM(CASE WHEN attending = 'no' THEN 1 ELSE 0 END) AS declined,
        SUM(CASE WHEN attending = 'yes' THEN guests ELSE 0 END) AS total_guests
      FROM rsvp
    `) ?? null;

    res.json({
      total_responses: stats?.total_responses || 0,
      confirmations: stats?.confirmations || 0,
      declined: stats?.declined || 0,
      total_guests: stats?.total_guests || 0
    });
  }));

  // Export every RSVP as CSV (admin). UTF-8 BOM so spreadsheets render accents.
  app.get('/api/rsvps/export.csv', basicAuth, asyncHandler((_req, res) => {
    const rows = db.all<RsvpRow>('SELECT * FROM rsvp ORDER BY created_at DESC, id DESC');
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
  app.get('/api/rsvp/lookup/:phone', asyncHandler((req, res) => {
    const phone = normalizePhone(String(req.params.phone ?? ''));
    if (!phone) {
      return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }
    const row = db.get<RsvpRow>(
      'SELECT * FROM rsvp WHERE phone = ? ORDER BY created_at DESC LIMIT 1',
      [phone]
    );
    if (!row) {
      return res.status(404).json({ error: 'Aucune réponse trouvée pour ce numéro de téléphone' });
    }
    res.json(row);
  }));

  // Submit (or update) an RSVP. Phone is the guest identity: one per phone.
  app.post('/api/rsvp', rsvpLimiter, asyncHandler((req, res) => {
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

    const existing = db.get<{ id: number }>('SELECT id FROM rsvp WHERE phone = ?', [phone]);

    if (existing) {
      db.run(`
        UPDATE rsvp
        SET attending = ?, name = ?, email = ?, guests = ?, message = ?,
            ip_address = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [attending, body.name, email, guests, message, ipAddress, existing.id]);
      return res.json({ message: 'Réponse mise à jour avec succès !', id: existing.id });
    }

    const result = db.run(`
      INSERT INTO rsvp (attending, name, email, phone, guests, message, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [attending, body.name, email, phone, guests, message, ipAddress]);

    res.status(201).json({ message: 'Réponse soumise avec succès !', id: Number(result.lastID) });
  }));

  // Update an arbitrary RSVP (admin).
  app.put('/api/rsvp/:id', basicAuth, asyncHandler((req, res) => {
    const parsed = rsvpSchema({ requireAttending: false, minGuests: 0 }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: firstError(parsed.error) });
    }
    const body = parsed.data;

    const result = db.run(`
      UPDATE rsvp
      SET attending = ?, name = ?, email = ?, phone = ?, guests = ?, message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      body.attending ?? 'yes',
      body.name,
      body.email ? body.email : null,
      normalizePhone(body.phone),
      body.guests ?? 1,
      body.message ? body.message : null,
      req.params.id
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP mis à jour avec succès !', changes: result.changes });
  }));

  // Delete an RSVP (admin).
  app.delete('/api/rsvp/:id', basicAuth, asyncHandler((req, res) => {
    const result = db.run('DELETE FROM rsvp WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'RSVP non trouvé' });
    }
    res.json({ message: 'RSVP supprimé avec succès !', changes: result.changes });
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
