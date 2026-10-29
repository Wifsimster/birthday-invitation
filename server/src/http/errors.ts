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

export const GENERIC_ERROR = 'Une erreur s\'est produite !';

export function statusOf(error: DomainError): number {
  return STATUS[error.kind];
}

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
