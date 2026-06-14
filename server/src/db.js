import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default on-disk location. In the container this is overridden by DB_PATH
// (see compose.yml -> /app/data/rsvp.db).
export function defaultDbPath() {
    return process.env.DB_PATH || path.join(__dirname, '../..', 'data', 'rsvp.db');
}

// Thin promise wrapper around a sqlite3 Database handle so route handlers can
// use async/await instead of nested callbacks.
export function wrapDb(handle) {
    return {
        raw: handle,
        run(sql, params = []) {
            return new Promise((resolve, reject) => {
                handle.run(sql, params, function (err) {
                    if (err) reject(err);
                    // `this` carries lastID / changes for INSERT/UPDATE/DELETE.
                    else resolve(this);
                });
            });
        },
        get(sql, params = []) {
            return new Promise((resolve, reject) => {
                handle.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
            });
        },
        all(sql, params = []) {
            return new Promise((resolve, reject) => {
                handle.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
            });
        },
        close() {
            return new Promise((resolve, reject) => {
                handle.close((err) => (err ? reject(err) : resolve()));
            });
        }
    };
}

// Open (and create if missing) the SQLite database, returning the wrapped handle.
export function openDb(dbPath = defaultDbPath()) {
    return new Promise((resolve, reject) => {
        const handle = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else resolve(wrapDb(handle));
        });
    });
}

// Create the schema and apply migrations. Idempotent — safe to run on every boot.
export async function initSchema(db) {
    await db.run(`CREATE TABLE IF NOT EXISTS rsvp (
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
)`);

    // Migration for databases created before the `attending` column existed.
    try {
        await db.run(
            `ALTER TABLE rsvp ADD COLUMN attending TEXT DEFAULT 'yes' CHECK(attending IN ('yes', 'no'))`
        );
    } catch (err) {
        if (!/duplicate column name/.test(err.message)) throw err;
    }

    // One RSVP per phone number.
    await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_phone ON rsvp(phone)');

    return db;
}
