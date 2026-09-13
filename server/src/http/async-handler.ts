// Wrap an async route handler so rejected promises reach the error middleware.
// Without it an awaited failure inside a handler becomes an unhandled rejection
// and the request hangs until the client gives up.

import type { NextFunction, Request, Response } from 'express';

export type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export const asyncHandler =
  (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
