import { Router } from 'express';
import { asyncHandler } from '../http/async-handler.ts';

export interface HealthDeps {
  /** Throws when the database is unreachable. */
  checkDatabase(): void;
}

/**
 * Health check. Also verifies the database is reachable/writable-ish so the
 * probe fails when SQLite is unusable, not just when the process is up.
 */
export function createHealthRoutes({ checkDatabase }: HealthDeps): Router {
  const router = Router();

  router.get('/api/health', asyncHandler((_req, res) => {
    const timestamp = new Date().toISOString();
    try {
      checkDatabase();
    } catch {
      return res.status(503).json({ status: 'unavailable', timestamp });
    }
    res.json({ status: 'OK', timestamp });
  }));

  return router;
}
