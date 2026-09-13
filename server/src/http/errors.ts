// The one place that turns a failure into a response.
//
// Services raise DomainErrors that say what went wrong in domain terms; this
// module owns the mapping onto status codes, and the rule that an unexpected
// error never leaks its message to the caller.

import type { NextFunction, Request, Response } from 'express';
import { DomainError, type DomainErrorKind } from '../domain/errors.ts';
import { logger as defaultLogger, type Logger } from '../logger.ts';

const STATUS: Record<DomainErrorKind, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unavailable: 503
};

/** The generic message every unexpected failure answers with. */
export const GENERIC_ERROR = 'Une erreur s\'est produite !';

export function statusOf(error: DomainError): number {
  return STATUS[error.kind];
}

/**
 * Terminal error middleware. A DomainError is a refusal we chose to express, so
 * it answers with its own message (and any `code` the SPA branches on).
 * Anything else — a thrown library error, a bad JSON body, a bug — answers with
 * the generic message, and is logged when it means the server failed.
 */
export function createErrorHandler(logger: Logger = defaultLogger) {
  return (
    err: Error & { status?: number; statusCode?: number },
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    if (err instanceof DomainError) {
      res.status(statusOf(err)).json({ error: err.message, ...err.details });
      return;
    }
    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
      (req.log ?? logger).error({ err }, 'request failed');
    }
    res.status(status).json({ error: GENERIC_ERROR });
  };
}
