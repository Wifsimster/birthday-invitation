// Account administration: who may reach the console, and removing an account.
//
// Better Auth owns the credential tables, so the writes go through its internal
// adapter; the rules about *when* a write is allowed live here. Every one of
// them exists to keep the deployment reachable — a dashboard nobody can open
// any more cannot be repaired from inside the app.

import type { Auth } from '../auth.ts';
import { invalid, notFound } from '../domain/errors.ts';
import type { Actor } from '../domain/access.ts';
import type { Role } from '../auth.ts';
import type { EventRepository, UserRepository, UserRow } from '../repositories/types.ts';
import { logger as defaultLogger, type Logger } from '../logger.ts';

export interface UserService {
  list(): UserRow[];
  /** Grant or revoke the admin role. Returns the row as it now reads. */
  setRole(actor: Actor, targetId: string, role: Role): Promise<UserRow>;
  /** Delete an account, its credentials and its invitations. */
  remove(actor: Actor, targetId: string): Promise<{ events: number }>;
}

export interface UserServiceDeps {
  auth: Auth;
  users: UserRepository;
  events: EventRepository;
  logger?: Logger;
}

export function createUserService(
  { auth, users, events, logger = defaultLogger }: UserServiceDeps
): UserService {
  const requireTarget = (id: string): UserRow => {
    const target = users.findById(id);
    if (!target) throw notFound('Compte introuvable');
    return target;
  };

  // The last admin may not be demoted or deleted: that would lock everyone out
  // of the console, with no way back short of editing the database by hand.
  const refuseLastAdmin = (target: UserRow): void => {
    if (target.role === 'admin' && users.countAdmins() <= 1) {
      throw invalid('Il doit rester au moins un administrateur.');
    }
  };

  return {
    list() {
      return users.list();
    },

    async setRole(actor, targetId, role) {
      const target = requireTarget(targetId);
      if (target.id === actor.id && role !== 'admin') {
        throw invalid('Vous ne pouvez pas retirer votre propre accès administrateur.');
      }
      if (role !== 'admin') refuseLastAdmin(target);

      const ctx = await auth.$context;
      await ctx.internalAdapter.updateUser(target.id, { role });
      // A demoted account still holds a valid session cookie. Drop its sessions
      // so the loss of access is immediate rather than deferred to the next
      // sign-in.
      if (role !== 'admin') users.deleteSessions(target.id);
      logger.info({ actor: actor.id, target: target.id, role }, 'user role changed');
      return { ...target, role };
    },

    async remove(actor, targetId) {
      const target = requireTarget(targetId);
      if (target.id === actor.id) {
        throw invalid('Vous ne pouvez pas supprimer votre propre compte.');
      }
      refuseLastAdmin(target);

      const ctx = await auth.$context;
      // Account first: a failed deleteUser must not leave an account whose
      // invitations were already destroyed. The reverse order only risks events
      // outliving their owner, which an admin can still see and clean up.
      //
      // The invitations go with it — and their RSVPs by the event_id cascade.
      // Leaving them behind would keep publicly reachable invitation pages that
      // no account can manage any more, since ownership is what grants access.
      await ctx.internalAdapter.deleteUser(target.id);
      const removed = events.deleteByOwner(target.id);
      logger.info({ actor: actor.id, target: target.id, events: removed }, 'user deleted');
      return { events: removed };
    }
  };
}
