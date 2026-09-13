// Schema history.
//
// Ordered, idempotent migrations, kept away from the connection handling so that
// opening a database and evolving its schema stay separate concerns. Each entry
// runs once; the applied version is tracked via SQLite's PRAGMA user_version.
// Append new migrations — never edit or reorder existing ones.

import { DEFAULT_THEME, LEGACY_THEME_ALIASES, THEME_IDS } from './themes.ts';
import type { Db } from './db.ts';

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
  theme TEXT NOT NULL DEFAULT 'kid',
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
  },
  // v4: per-account invitations. `owner_id` holds the Better Auth user id of the
  // account that created the event, so any registered account can run several
  // invitations of its own and only ever sees those. Existing rows (the
  // env-seeded default event included) keep a NULL owner: they belong to the
  // deployment and stay admin-managed.
  //
  // No FOREIGN KEY here on purpose: Better Auth owns the `user` table and
  // creates it in its own migration, which runs *after* initSchema — a
  // reference would resolve to a missing table on a fresh database.
  (db) => {
    try {
      db.run('ALTER TABLE event ADD COLUMN owner_id TEXT');
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }
    db.run('CREATE INDEX IF NOT EXISTS idx_event_owner ON event(owner_id)');
  },
  // v5: the theme catalog was replaced. The old ids named a character or a
  // motif and all rendered the same white card; the new ones each carry their
  // own structure (see frontend/src/assets/themes.css). Every stored id is
  // remapped onto the survivor closest to how it actually looked, so existing
  // invitations keep a deliberate appearance rather than resetting to the
  // default. Anything unrecognised — a hand-edited row, a much older backup —
  // lands on the default, which is what the API would have served it anyway.
  (db) => {
    for (const [legacy, current] of Object.entries(LEGACY_THEME_ALIASES)) {
      db.run('UPDATE event SET theme = ? WHERE theme = ?', [current, legacy]);
    }
    const known = [...THEME_IDS];
    db.run(
      `UPDATE event SET theme = ? WHERE theme NOT IN (${known.map(() => '?').join(', ')})`,
      [DEFAULT_THEME, ...known]
    );
    // The theme lived in `settings` before v3 and is migrated from there on
    // boot (see event.ts), so a stale row would reintroduce a retired id.
    db.run('DELETE FROM settings WHERE key = ?', ['theme']);
  },
  // v6: opt-in sharing of a response with the other guests. A confirmed guest
  // may tick a box on the invitation form; only rows with share_response = 1
  // are ever listed back to the other guests (see the participants route in
  // app.ts). Defaults to 0, so responses recorded before this migration — and
  // anyone who does not tick the box — stay private.
  (db) => {
    try {
      db.run('ALTER TABLE rsvp ADD COLUMN share_response INTEGER NOT NULL DEFAULT 0');
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }
  }
];

/**
 * Apply every migration the database has not seen yet, then back-fill the
 * columns that predate version tracking. Idempotent — safe on every boot.
 */
export function runMigrations(db: Db): void {
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
    'ALTER TABLE rsvp ADD COLUMN dietary_restrictions TEXT',
    'ALTER TABLE rsvp ADD COLUMN share_response INTEGER NOT NULL DEFAULT 0'
  ]) {
    try {
      db.run(ddl);
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }
  }
}
