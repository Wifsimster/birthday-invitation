import type { Auth } from '../auth.ts';
import { invalid, notFound } from '../domain/errors.ts';
import type { Actor } from '../domain/access.ts';
import type { Role } from '../auth.ts';
import type { EventRepository, UserRepository, UserRow } from '../repositories/types.ts';
import { logger as defaultLogger, type Logger } from '../logger.ts';

export interface UserService {
  list(): UserRow[];
  setRole(actor: Actor, targetId: string, role: Role): Promise<UserRow>;
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
      await ctx.internalAdapter.deleteUser(target.id);
      const removed = events.deleteByOwner(target.id);
      logger.info({ actor: actor.id, target: target.id, events: removed }, 'user deleted');
      return { events: removed };
    }
  };
}
