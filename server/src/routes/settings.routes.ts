import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';
import { parseBody, settingsSchema } from '../http/validation.ts';
import type { RouteDeps } from './deps.ts';

export function createSettingsRoutes({ guards, events }: Pick<RouteDeps, 'guards' | 'events'>): Router {
  const router = Router();

  router.get('/api/settings', asyncHandler((_req, res) => {
    res.json({ theme: events.defaultEvent().theme });
  }));

  router.put('/api/settings', ...guards.admin, asyncHandler((req, res) => {
    const { theme } = parseBody(settingsSchema, req.body);
    events.setTheme(events.defaultEvent().id, theme);
    res.json({ theme });
  }));

  return router;
}
