import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default on-disk location. In the container this is overridden by DB_PATH
// (see compose.yml -> /app/data/rsvp.db).
export function defaultDbPath() {
    return process.env.DB_PATH || path.join(__dirname, '../..', 'data', 'rsvp.db');
}

// better-sqlite3 is synchronous, so this is a thin adapter (no promises) exposing
// the run/get/all shape the routes use. `run` normalises the result to the same
// { lastID, changes } the rest of the code expects.
export function wrapDb(handle) {
    return {
        raw: handle,
        run(sql, params = []) {
            const info = handle.prepare(sql).run(...params);
            return { lastID: info.lastInsertRowid, changes: info.changes };
        },
        get(sql, params = []) {
            return handle.prepare(sql).get(...params);
        },
        all(sql, params = []) {
            return handle.prepare(sql).all(...params);
        },
        close() {
            handle.close();
        }
    };
}

// Open (and create if missing) the SQLite database, returning the wrapped handle.
export function openDb(dbPath = defaultDbPath()) {
    return wrapDb(new Database(dbPath));
}

// Create the schema and apply migrations. Idempotent — safe to run on every boot.
export function initSchema(db) {
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
)`);

    // Migration for databases created before the `attending` column existed.
    try {
        db.run(
            `ALTER TABLE rsvp ADD COLUMN attending TEXT DEFAULT 'yes' CHECK(attending IN ('yes', 'no'))`
        );
    } catch (err) {
        if (!/duplicate column name/.test(err.message)) throw err;
    }

    // One RSVP per phone number.
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_phone ON rsvp(phone)');

    return db;
}
