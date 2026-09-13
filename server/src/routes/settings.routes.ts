import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { parseBody, settingsSchema } from '../http/validation.ts';
import type { RouteDeps } from './deps.ts';

/**
 * Deployment-wide UI settings — currently just the theme, which lives on the
 * default event row.
 */
export function createSettingsRoutes({ guards, events }: Pick<RouteDeps, 'guards' | 'events'>): Router {
  const router = Router();

  // Public: the current theme. Defaults to the column default when never chosen.
  router.get('/api/settings', asyncHandler((_req, res) => {
    res.json({ theme: events.defaultEvent().theme });
  }));

  // Admin: choose the active UI theme, validated against the shared allow-list.
  router.put('/api/settings', ...guards.admin, asyncHandler((req, res) => {
    const { theme } = parseBody(settingsSchema, req.body);
    events.setTheme(events.defaultEvent().id, theme);
    res.json({ theme });
  }));

  return router;
}
