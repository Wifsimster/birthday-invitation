import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export function createTestApp() {
    const app = express();

    // Use test database
    const db = new sqlite3.Database('test-rsvp.db');

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    // Reduced rate limiting for testing
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000 // higher limit for testing
    });
    app.use(limiter);

    // RSVP specific rate limiting (more permissive for testing)
    const rsvpLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 100, // higher limit for testing
        message: { error: 'Too many RSVP attempts, please try again later.' }
    });

    // API Routes

    // Get all RSVPs
    app.get('/api/rsvps', (req, res) => {
        db.all('SELECT * FROM rsvp ORDER BY created_at DESC', [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ rsvps: rows });
        });
    });

    // Get RSVP count
    app.get('/api/rsvps/count', (req, res) => {
        db.get('SELECT COUNT(*) as count, SUM(guests) as total_guests FROM rsvp', [], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                confirmations: row.count,
                total_guests: row.total_guests || 0
            });
        });
    });

    // Submit RSVP
    app.post('/api/rsvp', rsvpLimiter, (req, res) => {
        const { name, email, phone, guests } = req.body;
        const ip_address = req.ip || req.connection.remoteAddress;

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (guests && (guests < 1 || guests > 10)) {
            return res.status(400).json({ error: 'Number of guests must be between 1 and 10' });
        }

        // Insert new RSVP (skip duplicate check for testing)
        const stmt = db.prepare(`
      INSERT INTO rsvp (name, email, phone, guests, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `);

        stmt.run([
            name.trim(),
            email ? email.trim() : null,
            phone ? phone.trim() : null,
            guests || 1,
            ip_address
        ], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.status(201).json({
                message: 'RSVP submitted successfully!',
                id: this.lastID
            });
        });

        stmt.finalize();
    });

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Something went wrong!' });
    });

    return { app, db };
}
