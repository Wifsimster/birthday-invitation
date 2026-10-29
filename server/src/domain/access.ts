import type { Role } from '../auth.ts';
import type { EventRow } from '../db.ts';

export interface Actor {
  id: string;
  role: Role;
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === 'admin';
}

export function canManageEvent(actor: Actor, event: EventRow): boolean {
  return isAdmin(actor) || (event.owner_id !== null && event.owner_id === actor.id);
}

export function visibleOwnerId(actor: Actor): string | undefined {
  return isAdmin(actor) ? undefined : actor.id;
}
