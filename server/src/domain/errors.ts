// Domain-level failures, expressed in the language of the domain rather than of
// HTTP. A service says "this event does not exist" or "that phone number is
// already taken"; the transport layer (http/errors.ts) is the only place that
// knows those mean 404 and 409. Keeping the mapping there lets the same
// services back a CLI, a job or a different protocol without dragging Express
// status codes through the business rules.

export type DomainErrorKind =
  | 'invalid'       // the caller sent something the rules reject
  | 'unauthorized'  // no identity
  | 'forbidden'     // an identity, but not one allowed to do this
  | 'not_found'
  | 'conflict'      // collides with something already stored
  | 'unavailable';  // a dependency (the database) is not answering

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  // Extra fields merged into the error payload — the SPA branches on `code` to
  // tell "not signed in" from "signed in without access".
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
