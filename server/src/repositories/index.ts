import type { Db } from '../db.ts';
import { createEventRepository } from './event.repository.ts';
import { createRsvpRepository } from './rsvp.repository.ts';
import { createSettingsRepository } from './settings.repository.ts';
import { createUserRepository } from './user.repository.ts';
import type { Repositories } from './types.ts';

export function createRepositories(db: Db): Repositories {
  return {
    events: createEventRepository(db),
    rsvps: createRsvpRepository(db),
    users: createUserRepository(db),
    settings: createSettingsRepository(db)
  };
}

export * from './types.ts';
