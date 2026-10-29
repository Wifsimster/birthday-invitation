import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { currentUser } from '../http/guards.ts';
import { currentAccount } from '../http/presenters.ts';
import type { RouteDeps } from './deps.ts';

export function createAccountRoutes({ auth }: Pick<RouteDeps, 'auth'>): Router {
  const router = Router();

  router.get('/api/auth-providers', (_req, res) => {
    res.json({
      emailPassword: true,
      google: Boolean(auth.options.socialProviders?.google)
    });
  });

  router.get('/api/me', asyncHandler(async (req, res) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({ user: currentAccount(user) });
  }));

  return router;
}
