// Who may act on what.
//
// One module owns the answer, so a second role — or a shared-ownership rule
// later on — is a change here rather than a hunt through the route handlers for
// every inline `role === 'admin'`.

import type { Role } from '../auth.ts';
import type { EventRow } from '../db.ts';

/** The acting account, as any policy below needs to see it. */
export interface Actor {
  id: string;
  role: Role;
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === 'admin';
}

/**
 * May this account manage this event? An admin manages every invitation,
 * including the env-seeded default one (which has no owner). Everyone else
 * manages exactly the invitations they created.
 */
export function canManageEvent(actor: Actor, event: EventRow): boolean {
  return isAdmin(actor) || (event.owner_id !== null && event.owner_id === actor.id);
}

/** Events an account may see listed: its own, or all of them for an admin. */
export function visibleOwnerId(actor: Actor): string | undefined {
  return isAdmin(actor) ? undefined : actor.id;
}
