import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Wrap an async route handler so rejected promises reach the error middleware
// instead of crashing the process.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Build a Basic-Auth middleware. Fails closed (503) when credentials are unset.
function makeBasicAuth({ username, password }) {
    return function basicAuth(req, res, next) {
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

/**
 * Build the Express application around an (already initialised) database.
 *
 * Keeping this a pure factory — no listener, no process state — is what lets the
 * test suite exercise the *real* routes against an in-memory database.
 *
 * @param {object} db    Wrapped database handle (see db.js).
 * @param {object} [options]
 * @param {string} [options.adminUsername]
 * @param {string} [options.adminPassword]
 * @param {number} [options.trustProxy]   Number of proxy hops to trust for req.ip.
 * @param {object} [options.rateLimits]   Override default limiter windows/maxes.
 */
export function createApp(db, options = {}) {
    const {
        adminUsername = process.env.ADMIN_USERNAME,
        adminPassword = process.env.ADMIN_PASSWORD,
        trustProxy = Number(process.env.TRUST_PROXY ?? 1),
        rateLimits = {}
    } = options;

    const app = express();

    // Behind Caddy (and Traefik) — trust the forwarding hop(s) so req.ip is the
    // real client address and per-IP rate limiting actually works.
    app.set('trust proxy', trustProxy);

    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    const basicAuth = makeBasicAuth({ username: adminUsername, password: adminPassword });

    // Global rate limit.
    app.use(rateLimit({
        windowMs: rateLimits.globalWindowMs ?? 15 * 60 * 1000,
        max: rateLimits.globalMax ?? 100
    }));

    // Stricter limit on writes.
    const rsvpLimiter = rateLimit({
        windowMs: rateLimits.rsvpWindowMs ?? 60 * 60 * 1000,
        max: rateLimits.rsvpMax ?? 5,
        message: { error: 'Trop de tentatives de réponse, veuillez réessayer plus tard.' }
    });

    // --- Routes ---------------------------------------------------------------

    app.get('/api/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // All RSVPs (admin).
    app.get('/api/rsvps', basicAuth, asyncHandler(async (req, res) => {
        const rsvps = await db.all('SELECT * FROM rsvp ORDER BY created_at DESC, id DESC');
        res.json({ rsvps });
    }));

    // Aggregate counts (admin).
    app.get('/api/rsvps/count', basicAuth, asyncHandler(async (req, res) => {
        const stats = await db.get(`
            SELECT
                COUNT(*) AS total_responses,
                SUM(CASE WHEN attending = 'yes' THEN 1 ELSE 0 END) AS confirmations,
                SUM(CASE WHEN attending = 'no' THEN 1 ELSE 0 END) AS declined,
                SUM(CASE WHEN attending = 'yes' THEN guests ELSE 0 END) AS total_guests
            FROM rsvp
        `) || {};

        res.json({
            total_responses: stats.total_responses || 0,
            confirmations: stats.confirmations || 0,
            declined: stats.declined || 0,
            total_guests: stats.total_guests || 0
        });
    }));

    // Look up an existing RSVP so a guest can pre-fill / edit their response.
    app.get('/api/rsvp/lookup/:phone', asyncHandler(async (req, res) => {
        const phone = (req.params.phone || '').trim();
        if (!phone) {
            return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
        }

        const row = await db.get(
            'SELECT * FROM rsvp WHERE phone = ? ORDER BY created_at DESC LIMIT 1',
            [phone]
        );
        if (!row) {
            return res.status(404).json({ error: 'Aucune réponse trouvée pour ce numéro de téléphone' });
        }
        res.json(row);
    }));

    // Submit (or update) an RSVP. Phone number is the guest's identity: one RSVP
    // per phone, re-submitting updates the existing row.
    app.post('/api/rsvp', rsvpLimiter, asyncHandler(async (req, res) => {
        // Express 5 leaves req.body undefined when no body parser matched.
        const { attending, name, email, phone, guests, message } = req.body || {};
        const ipAddress = req.ip;

        const errorMessage = validateRsvp({ name, phone, attending, guests });
        if (errorMessage) {
            return res.status(400).json({ error: errorMessage });
        }

        const trimmedPhone = phone.trim();
        const resolvedGuests = attending === 'yes' ? (guests || 1) : 0;
        const trimmedEmail = email ? email.trim() : null;
        const trimmedMessage = message ? message.trim() : null;

        const existing = await db.get('SELECT id FROM rsvp WHERE phone = ?', [trimmedPhone]);

        if (existing) {
            await db.run(`
                UPDATE rsvp
                SET attending = ?, name = ?, email = ?, guests = ?, message = ?,
                    ip_address = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [attending, name.trim(), trimmedEmail, resolvedGuests, trimmedMessage, ipAddress, existing.id]);

            return res.json({ message: 'Réponse mise à jour avec succès !', id: existing.id });
        }

        const result = await db.run(`
            INSERT INTO rsvp (attending, name, email, phone, guests, message, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [attending, name.trim(), trimmedEmail, trimmedPhone, resolvedGuests, trimmedMessage, ipAddress]);

        res.status(201).json({ message: 'Réponse soumise avec succès !', id: result.lastID });
    }));

    // Update an arbitrary RSVP (admin).
    app.put('/api/rsvp/:id', basicAuth, asyncHandler(async (req, res) => {
        const { attending, name, email, phone, guests, message } = req.body || {};

        const errorMessage = validateRsvp({ name, phone, attending, guests, allowZeroGuests: true });
        if (errorMessage) {
            return res.status(400).json({ error: errorMessage });
        }

        const result = await db.run(`
            UPDATE rsvp
            SET attending = ?, name = ?, email = ?, phone = ?, guests = ?, message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            attending || 'yes',
            name.trim(),
            email ? email.trim() : null,
            phone.trim(),
            guests || 1,
            message ? message.trim() : null,
            req.params.id
        ]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'RSVP non trouvé' });
        }
        res.json({ message: 'RSVP mis à jour avec succès !', changes: result.changes });
    }));

    // Delete an RSVP (admin).
    app.delete('/api/rsvp/:id', basicAuth, asyncHandler(async (req, res) => {
        const result = await db.run('DELETE FROM rsvp WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'RSVP non trouvé' });
        }
        res.json({ message: 'RSVP supprimé avec succès !', changes: result.changes });
    }));

    // --- Error handling -------------------------------------------------------

    // eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
    app.use((err, req, res, next) => {
        // Body-parser and similar middleware attach an HTTP status (e.g. 400 for
        // malformed JSON); honour it rather than masking everything as 500.
        const status = err.status || err.statusCode || 500;
        if (status >= 500) {
            console.error(err.stack || err.message);
        }
        res.status(status).json({ error: 'Une erreur s\'est produite !' });
    });

    return app;
}

// Shared request validation. Returns an error string, or null when valid.
function validateRsvp({ name, phone, attending, guests, allowZeroGuests = false }) {
    if (!name || name.trim().length === 0) {
        return 'Le nom est requis';
    }
    if (!phone || phone.trim().length === 0) {
        return 'Le numéro de téléphone est requis';
    }
    if (!attending || !['yes', 'no'].includes(attending)) {
        return 'Le statut de participation est requis';
    }
    const minGuests = allowZeroGuests ? 0 : 1;
    if (guests != null && (guests < minGuests || guests > 10)) {
        return `Le nombre d'invités doit être entre ${minGuests} et 10`;
    }
    return null;
}
