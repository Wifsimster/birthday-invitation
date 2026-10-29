import { DEFAULT_THEME, LEGACY_THEME_ALIASES, THEME_IDS } from './themes.ts';
import type { Db } from './db.ts';

const MIGRATIONS: ((db: Db) => void)[] = [
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
  (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
  },
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

    const hasDefault = db.get<{ id: number }>('SELECT id FROM event WHERE is_default = 1 LIMIT 1');
    if (!hasDefault) {
      db.run("INSERT OR IGNORE INTO event (slug, is_default) VALUES ('default', 1)");
      db.run("UPDATE event SET is_default = 1 WHERE slug = 'default'");
    }

    try {
      db.run('ALTER TABLE rsvp ADD COLUMN event_id INTEGER REFERENCES event(id) ON DELETE CASCADE');
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }

    const defaultRow = db.get<{ id: number }>('SELECT id FROM event WHERE is_default = 1 ORDER BY id LIMIT 1');
    if (defaultRow) {
      db.run('UPDATE rsvp SET event_id = ? WHERE event_id IS NULL', [defaultRow.id]);
    }

    db.run('DROP INDEX IF EXISTS idx_rsvp_phone');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_event_phone ON rsvp(event_id, phone)');
  },
  (db) => {
    try {
      db.run('ALTER TABLE event ADD COLUMN owner_id TEXT');
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }
    db.run('CREATE INDEX IF NOT EXISTS idx_event_owner ON event(owner_id)');
  },
  (db) => {
    for (const [legacy, current] of Object.entries(LEGACY_THEME_ALIASES)) {
      db.run('UPDATE event SET theme = ? WHERE theme = ?', [current, legacy]);
    }
    const known = [...THEME_IDS];
    db.run(
      `UPDATE event SET theme = ? WHERE theme NOT IN (${known.map(() => '?').join(', ')})`,
      [DEFAULT_THEME, ...known]
    );
    db.run('DELETE FROM settings WHERE key = ?', ['theme']);
  },
  (db) => {
    try {
      db.run('ALTER TABLE rsvp ADD COLUMN share_response INTEGER NOT NULL DEFAULT 0');
    } catch (err) {
      if (!/duplicate column name/.test((err as Error).message)) throw err;
    }
  }
];

export function runMigrations(db: Db): void {
  const hasRsvp = db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='rsvp'"
  );
  let version = (db.get<{ user_version: number }>('PRAGMA user_version')?.user_version) ?? 0;
  if (version === 0 && hasRsvp) version = 1;

  for (let i = version; i < MIGRATIONS.length; i++) {
    MIGRATIONS[i](db);
  }
  db.run(`PRAGMA user_version = ${MIGRATIONS.length}`);

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
