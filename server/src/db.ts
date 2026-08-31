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

export interface EventRow {
  id: number;
  slug: string;
  person: string;
  age: string;
  date: string;
  time: string;
  town: string;
  location: string;
  dress_code: string;
  theme: string;
  rsvp_deadline: string;
  is_default: number;
  created_at: string;
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
// WAL + a busy timeout make the single-file store resilient to unclean restarts
// and concurrent readers (e.g. an online `.backup`).
export function openDb(dbPath: string = defaultDbPath()): Db {
  const handle = new Database(dbPath);
  handle.pragma('journal_mode = WAL');
  handle.pragma('busy_timeout = 5000');
  handle.pragma('synchronous = NORMAL');
  handle.pragma('foreign_keys = ON');
  return wrapDb(handle);
}

// Ordered, idempotent migrations. Each entry runs once; the applied version is
// tracked via SQLite's PRAGMA user_version. Append new migrations — never edit
// or reorder existing ones.
const MIGRATIONS: ((db: Db) => void)[] = [
  // v1: base RSVP table + one-RSVP-per-phone index.
  (db) => {
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
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_phone ON rsvp(phone)');
  },
  // v2: generic key/value settings store (selected theme, editable event fields).
  (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
  },
  // v3: multi-event support. An `event` table holds each invitation (theme,
  // slug, details); rsvp rows gain an `event_id` and uniqueness moves to
  // (event_id, phone). A single default event keeps the legacy single-event
  // routes (env-configured) working unchanged.
  (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  person TEXT NOT NULL DEFAULT '',
  age TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  town TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  dress_code TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'fiesta',
  rsvp_deadline TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

    // Ensure exactly one default event exists.
    const hasDefault = db.get<{ id: number }>('SELECT id FROM event WHERE is_default = 1 LIMIT 1');
    if (!hasDefault) {
      db.run("INSERT OR IGNORE INTO event (slug, is_default) VALUES ('default', 1)");
      db.run("UPDATE event SET is_default = 1 WHERE slug = 'default'");
    }

    // Add event_id to rsvp (idempotent in the codebase's defensive style).
    try {
      db.run('ALTER TABLE rsvp ADD COLUMN event_id INTEGER REFERENCES event(id) ON DELETE CASCADE');
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }

    // Backfill existing rsvps onto the default event.
    const defaultRow = db.get<{ id: number }>('SELECT id FROM event WHERE is_default = 1 ORDER BY id LIMIT 1');
    if (defaultRow) {
      db.run('UPDATE rsvp SET event_id = ? WHERE event_id IS NULL', [defaultRow.id]);
    }

    // Swap the unique index: one RSVP per phone *per event*.
    db.run('DROP INDEX IF EXISTS idx_rsvp_phone');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_event_phone ON rsvp(event_id, phone)');
  }
];

// Create the schema and apply pending migrations. Idempotent — safe on every boot.
export function initSchema(db: Db): Db {
  // Pre-migration databases (created before user_version tracking) already have
  // the rsvp table; treat them as version 1 so we don't re-run the base create
  // destructively. A fresh DB reports user_version 0 and runs all migrations.
  const hasRsvp = db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='rsvp'"
  );
  let version = (db.get<{ user_version: number }>('PRAGMA user_version')?.user_version) ?? 0;
  if (version === 0 && hasRsvp) version = 1;

  for (let i = version; i < MIGRATIONS.length; i++) {
    MIGRATIONS[i](db);
  }
  db.run(`PRAGMA user_version = ${MIGRATIONS.length}`);

  // Back-fill columns on databases that predate them. Idempotent: a
  // "duplicate column name" just means the column already exists.
  for (const ddl of [
    `ALTER TABLE rsvp ADD COLUMN attending TEXT DEFAULT 'yes' CHECK(attending IN ('yes', 'no'))`,
    'ALTER TABLE rsvp ADD COLUMN dietary_restrictions TEXT'
  ]) {
    try {
      db.run(ddl);
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }
  }

  return db;
}
