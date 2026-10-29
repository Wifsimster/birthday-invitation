import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { actor } from '../http/guards.ts';
import { publicUser } from '../http/presenters.ts';
import { parseBody, userRoleSchema } from '../http/validation.ts';
import type { RouteDeps } from './deps.ts';

export function createUserRoutes({ guards, users }: Pick<RouteDeps, 'guards' | 'users'>): Router {
  const router = Router();

  router.get('/api/users', ...guards.admin, asyncHandler((_req, res) => {
    res.json({ users: users.list().map(publicUser) });
  }));

  router.put('/api/users/:id/role', ...guards.admin, asyncHandler(async (req, res) => {
    const { role } = parseBody(userRoleSchema, req.body);
    const updated = await users.setRole(actor(res), String(req.params.id), role);
    res.json({ user: publicUser(updated) });
  }));

  router.delete('/api/users/:id', ...guards.admin, asyncHandler(async (req, res) => {
    await users.remove(actor(res), String(req.params.id));
    res.json({ message: 'Compte supprimé' });
  }));

  return router;
}
