import type { Db } from '../db.ts';
import type { SettingsRepository } from './types.ts';

export function createSettingsRepository(db: Db): SettingsRepository {
  return {
    get(key) {
      return db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value;
    }
  };
}
