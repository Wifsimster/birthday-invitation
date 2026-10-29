import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrations.ts';

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
  share_response: number;
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
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunResult {
  lastID: number | bigint;
  changes: number;
}

export interface Db {
  raw: Database.Database;
  run(sql: string, params?: unknown[]): RunResult;
  get<T = unknown>(sql: string, params?: unknown[]): T | undefined;
  all<T = unknown>(sql: string, params?: unknown[]): T[];
  close(): void;
}

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

export function openDb(dbPath: string = defaultDbPath()): Db {
  const handle = new Database(dbPath);
  handle.pragma('journal_mode = WAL');
  handle.pragma('busy_timeout = 5000');
  handle.pragma('synchronous = NORMAL');
  handle.pragma('foreign_keys = ON');
  return wrapDb(handle);
}

export function initSchema(db: Db): Db {
  runMigrations(db);
  return db;
}
