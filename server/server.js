import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic authentication middleware
function basicAuth(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
        return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];

    // Credentials must be provided via environment — fail closed if unset.
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        return res.status(503).json({ error: 'Admin access is not configured' });
    }

    if (username === adminUsername && password === adminPassword) {
        next();
    } else {
        res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
        return res.status(401).json({ error: 'Invalid credentials' });
    }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// RSVP specific rate limiting (more restrictive)
const rsvpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 RSVP requests per hour
    message: { error: 'Trop de tentatives de réponse, veuillez réessayer plus tard.' }
});

// Initialize SQLite database
const dbPath = process.env.DB_PATH || path.join(__dirname, '../..', 'data', 'rsvp.db');
console.log(`[DEBUG] Initializing database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log(`Connected to SQLite database at: ${dbPath}`);

        // Log current RSVPs count for debugging
        db.get('SELECT COUNT(*) as count FROM rsvp', [], (err, row) => {
            if (err) {
                console.log('Could not count existing RSVPs:', err.message);
            } else {
                console.log(`[DEBUG] Current RSVPs in database: ${row.count}`);
            }
        });
    }
});

// Create RSVP table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS rsvp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  attending TEXT DEFAULT 'yes' CHECK(attending IN ('yes', 'no')),
  email TEXT,
  phone TEXT NOT NULL,
  guests INTEGER DEFAULT 1,
  dietary_restrictions TEXT,
  message TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) {
        console.error('[ERROR] Failed to create rsvp table:', err.message);
    } else {
        console.log('[DEBUG] RSVP table created or already exists');
    }
});

// Add attending column if it doesn't exist (for existing databases)
db.run(`ALTER TABLE rsvp ADD COLUMN attending TEXT DEFAULT 'yes' CHECK(attending IN ('yes', 'no'))`, (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding attending column:', err.message);
    }
});

// Create unique index on phone number to ensure uniqueness
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_phone ON rsvp(phone)`, (err) => {
    if (err && !err.message.includes('already exists')) {
        console.error('Error creating phone index:', err.message);
    }
});

// API Routes

// Get all RSVPs (for admin purposes)
app.get('/api/rsvps', basicAuth, (req, res) => {
    db.all('SELECT * FROM rsvp ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ rsvps: rows });
    });
});

// Get RSVP count
app.get('/api/rsvps/count', basicAuth, (req, res) => {
    db.all(`
        SELECT 
            COUNT(*) as total_responses,
            SUM(CASE WHEN attending = 'yes' THEN 1 ELSE 0 END) as confirmations,
            SUM(CASE WHEN attending = 'no' THEN 1 ELSE 0 END) as declined,
            SUM(CASE WHEN attending = 'yes' THEN guests ELSE 0 END) as total_guests
        FROM rsvp
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const stats = rows[0] || {};
        res.json({
            total_responses: stats.total_responses || 0,
            confirmations: stats.confirmations || 0,
            declined: stats.declined || 0,
            total_guests: stats.total_guests || 0
        });
    });
});

// Lookup RSVP by phone number
app.get('/api/rsvp/lookup/:phone', (req, res) => {
    const { phone } = req.params;

    if (!phone || phone.trim().length === 0) {
        return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }

    // Look for most recent RSVP with this phone number
    db.get(
        'SELECT * FROM rsvp WHERE phone = ? ORDER BY created_at DESC LIMIT 1',
        [phone.trim()],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!row) {
                return res.status(404).json({ error: 'Aucune réponse trouvée pour ce numéro de téléphone' });
            }

            res.json(row);
        }
    );
});

// Submit RSVP
app.post('/api/rsvp', rsvpLimiter, (req, res) => {
    const { attending, name, email, phone, guests, message } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;

    // Validation
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Le nom est requis' });
    }

    if (!phone || phone.trim().length === 0) {
        return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }

    if (!attending || !['yes', 'no'].includes(attending)) {
        return res.status(400).json({ error: 'Le statut de participation est requis' });
    }

    if (guests && (guests < 1 || guests > 10)) {
        return res.status(400).json({ error: 'Le nombre d\'invités doit être entre 1 et 10' });
    }

    // Check if this phone number already has an RSVP
    console.log(`[DEBUG] Checking for existing RSVP with phone: ${phone.trim()}, name: ${name.trim()}`);

    db.get(
        'SELECT id, name, phone FROM rsvp WHERE phone = ?',
        [phone.trim()],
        (err, existingRsvp) => {
            if (err) {
                console.error(`[ERROR] Database error during RSVP check:`, err);
                res.status(500).json({ error: err.message });
                return;
            }

            if (existingRsvp) {
                console.log(`[DEBUG] Found existing RSVP:`, existingRsvp);

                // Only update if it's the same person (same name and phone)
                if (existingRsvp.name.trim().toLowerCase() === name.trim().toLowerCase()) {
                    console.log(`[DEBUG] Updating existing RSVP for same person`);
                    // Update existing RSVP
                    const updateStmt = db.prepare(`
                        UPDATE rsvp 
                        SET attending = ?, email = ?, guests = ?, message = ?, updated_at = CURRENT_TIMESTAMP, ip_address = ?
                        WHERE id = ?
                    `);

                    updateStmt.run([
                        attending,
                        email ? email.trim() : null,
                        attending === 'yes' ? (guests || 1) : 0,
                        message ? message.trim() : null,
                        ip_address,
                        existingRsvp.id
                    ], function (err) {
                        if (err) {
                            console.error(`[ERROR] Failed to update RSVP:`, err);
                            res.status(500).json({ error: err.message });
                            return;
                        }

                        console.log(`[DEBUG] Successfully updated RSVP ${existingRsvp.id}`);
                        res.json({
                            message: 'Réponse mise à jour avec succès !',
                            id: existingRsvp.id
                        });
                    });

                    updateStmt.finalize();
                    return;
                } else {
                    console.log(`[DEBUG] Different name, treating as new RSVP. Existing: "${existingRsvp.name}" vs New: "${name.trim()}"`);
                    // Different person with same phone - this should create a new RSVP
                    // But first, let's warn about potential phone number conflict
                    console.warn(`[WARN] Phone number ${phone.trim()} already used by ${existingRsvp.name}, but creating new RSVP for ${name.trim()}`);
                }
            } else {
                console.log(`[DEBUG] No existing RSVP found for phone ${phone.trim()}`);
            }

            // Insert new RSVP
            console.log(`[DEBUG] Creating new RSVP for ${name.trim()}`);
            const stmt = db.prepare(`
                INSERT INTO rsvp (attending, name, email, phone, guests, message, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run([
                attending,
                name.trim(),
                email ? email.trim() : null,
                phone.trim(),
                attending === 'yes' ? (guests || 1) : 0,
                message ? message.trim() : null,
                ip_address
            ], function (err) {
                if (err) {
                    console.error(`[ERROR] Failed to insert new RSVP:`, err);
                    res.status(500).json({ error: err.message });
                    return;
                }

                console.log(`[DEBUG] Successfully created new RSVP with ID ${this.lastID}`);
                res.status(201).json({
                    message: 'Réponse soumise avec succès !',
                    id: this.lastID
                });
            });

            stmt.finalize();
        }
    );
});

// Update RSVP (for admin purposes)
app.put('/api/rsvp/:id', basicAuth, (req, res) => {
    const { id } = req.params;
    const { attending, name, email, phone, guests, message } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Le nom est requis' });
    }

    if (!phone || phone.trim().length === 0) {
        return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
    }

    if (attending && !['yes', 'no'].includes(attending)) {
        return res.status(400).json({ error: 'Le statut de participation doit être "yes" ou "no"' });
    }

    if (guests && (guests < 0 || guests > 10)) {
        return res.status(400).json({ error: 'Le nombre d\'invités doit être entre 0 et 10' });
    }

    const stmt = db.prepare(`
        UPDATE rsvp 
        SET attending = ?, name = ?, email = ?, phone = ?, guests = ?, message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    stmt.run([
        attending || 'yes',
        name.trim(),
        email ? email.trim() : null,
        phone.trim(),
        guests || 1,
        message ? message.trim() : null,
        id
    ], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'RSVP non trouvé' });
        }

        res.json({
            message: 'RSVP mis à jour avec succès !',
            changes: this.changes
        });
    });

    stmt.finalize();
});

// Delete RSVP (for admin purposes)
app.delete('/api/rsvp/:id', basicAuth, (req, res) => {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM rsvp WHERE id = ?');

    stmt.run([id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'RSVP non trouvé' });
        }

        res.json({
            message: 'RSVP supprimé avec succès !',
            changes: this.changes
        });
    });

    stmt.finalize();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint to check all RSVPs (remove in production!)
app.get('/api/debug/rsvps', (req, res) => {
    db.all('SELECT id, name, phone, attending, created_at FROM rsvp ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            count: rows.length,
            rsvps: rows.map(row => ({
                id: row.id,
                name: row.name,
                phone: row.phone,
                attending: row.attending,
                created_at: row.created_at
            }))
        });
    });
});

// Serve frontend static files in production
if (false && process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../dist');
    app.use(express.static(frontendPath));

    // Handle SPA routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Une erreur s\'est produite !' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
