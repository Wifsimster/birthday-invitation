import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface RsvpRow {
  id: number;
  name: string;
  attending: 'yes' | 'no';
  email: string | null;
  phone: string;
  guests: number;
  dietary_restrictions: string | null;
  message: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface RunResult {
  lastID: number | bigint;
  changes: number;
}

// Thin synchronous adapter over a better-sqlite3 handle, exposing the run/get/all
// shape the routes use. `run` normalises the result to { lastID, changes }.
export interface Db {
  raw: Database.Database;
  run(sql: string, params?: unknown[]): RunResult;
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined;
  all<T = unknown>(sql: string, params?: unknown[]): T[];
  close(): void;
}

// Default on-disk location. In the container this is overridden by DB_PATH
// (see compose.yml -> /app/data/rsvp.db).
export function defaultDbPath(): string {
  return process.env.DB_PATH || path.join(__dirname, '../..', 'data', 'rsvp.db');
}

export function wrapDb(handle: Database.Database): Db {
  return {
    raw: handle,
    run(sql, params = []) {
      const info = handle.prepare(sql).run(...(params as never[]));
      return { lastID: info.lastInsertRowid, changes: info.changes };
    },
    get(sql, params = []) {
      return handle.prepare(sql).get(...(params as never[])) as never;
    },
    all(sql, params = []) {
      return handle.prepare(sql).all(...(params as never[])) as never[];
    },
    close() {
      handle.close();
    }
  };
}

// Open (and create if missing) the SQLite database, returning the wrapped handle.
export function openDb(dbPath: string = defaultDbPath()): Db {
  return wrapDb(new Database(dbPath));
}

// Create the schema and apply migrations. Idempotent — safe to run on every boot.
export function initSchema(db: Db): Db {
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
    if (!/duplicate column name/.test((err as Error).message)) throw err;
  }

  // One RSVP per phone number.
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_phone ON rsvp(phone)');

  // Generic key/value store for admin-tunable settings (e.g. the selected UI
  // theme). Absence of a key means "use the application default".
  db.run(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

  return db;
}
