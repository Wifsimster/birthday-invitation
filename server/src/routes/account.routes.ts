import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { currentUser } from '../http/guards.ts';
import { currentAccount } from '../http/presenters.ts';
import type { RouteDeps } from './deps.ts';

/** The caller's own account, and what this deployment offers to sign in with. */
export function createAccountRoutes({ auth }: Pick<RouteDeps, 'auth'>): Router {
  const router = Router();

  // Public: which sign-in methods this deployment actually offers, so the SPA
  // only renders the Google button when the provider is configured.
  router.get('/api/auth-providers', (_req, res) => {
    res.json({
      emailPassword: true,
      google: Boolean(auth.options.socialProviders?.google)
    });
  });

  // The signed-in account, including its granted role. 401 when there is no
  // session. The SPA reads `role` to choose between the admin dashboard and the
  // pending-approval screen — it is deliberately not behind requireAdmin, since
  // a non-admin needs to be able to learn that it is a non-admin.
  router.get('/api/me', asyncHandler(async (req, res) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({ user: currentAccount(user) });
  }));

  return router;
}
