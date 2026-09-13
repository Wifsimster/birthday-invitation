import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { actor } from '../http/guards.ts';
import { publicUser } from '../http/presenters.ts';
import { parseBody, userRoleSchema } from '../http/validation.ts';
import type { RouteDeps } from './deps.ts';

/** Account administration. Admin-only: these routes span the whole deployment. */
export function createUserRoutes({ guards, users }: Pick<RouteDeps, 'guards' | 'users'>): Router {
  const router = Router();

  // Every registered account, so an admin can see who has signed up and grant or
  // revoke access.
  router.get('/api/users', ...guards.admin, asyncHandler((_req, res) => {
    res.json({ users: users.list().map(publicUser) });
  }));

  // Grant or revoke the admin role.
  router.put('/api/users/:id/role', ...guards.admin, asyncHandler(async (req, res) => {
    const { role } = parseBody(userRoleSchema, req.body);
    const updated = await users.setRole(actor(res), String(req.params.id), role);
    res.json({ user: publicUser(updated) });
  }));

  // Delete an account entirely (cascades its sessions, credentials and events).
  router.delete('/api/users/:id', ...guards.admin, asyncHandler(async (req, res) => {
    await users.remove(actor(res), String(req.params.id));
    res.json({ message: 'Compte supprimé' });
  }));

  return router;
}
