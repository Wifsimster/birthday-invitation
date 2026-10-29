export type DomainErrorKind =
  | 'invalid'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unavailable';

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly details?: Record<string, unknown>;

  constructor(kind: DomainErrorKind, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.kind = kind;
    this.details = details;
  }
}

export const invalid = (message: string, details?: Record<string, unknown>): DomainError =>
  new DomainError('invalid', message, details);

export const unauthorized = (message: string, details?: Record<string, unknown>): DomainError =>
  new DomainError('unauthorized', message, details);

export const forbidden = (message: string, details?: Record<string, unknown>): DomainError =>
  new DomainError('forbidden', message, details);

export const notFound = (message: string, details?: Record<string, unknown>): DomainError =>
  new DomainError('not_found', message, details);

export const conflict = (message: string, details?: Record<string, unknown>): DomainError =>
  new DomainError('conflict', message, details);
