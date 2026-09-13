// Request authentication.
//
// Two guards, both failing closed. They only answer "is there a session, and
// does it carry the role this branch of the API requires" — what a given
// account may do with a given event is a domain policy (domain/access.ts),
// applied by the services.

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { type Auth, DEFAULT_ROLE, isRole, type SessionUser } from '../auth.ts';
import { asyncHandler } from './async-handler.ts';

/**
 * Read the session and normalise the user, or null when unauthenticated. An
 * unrecognised role degrades to the least-privileged one rather than throwing.
 */
export async function currentUser(auth: Auth, req: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const user = session.user as unknown as Omit<SessionUser, 'role'> & { role?: unknown };
  return { ...user, role: isRole(user.role) ? user.role : DEFAULT_ROLE };
}

/**
 * The account acting on the current request. Only ever read inside routes
 * mounted behind a guard, both of which populate it.
 */
export function actor(res: Response): SessionUser {
  return res.locals.user as SessionUser;
}

/**
 * Any registered account passes: an account owns the invitations it creates, so
 * the event API is reachable without the admin role. Only a missing session is
 * refused (401) — the per-event ownership check decides what it may touch.
 */
export function requireUser(auth: Auth): RequestHandler {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.locals.user = user;
    next();
  });
}

/**
 * Admin-only. Distinguishes the two failure modes so the SPA can tell them
 * apart: 401 means "no session, show the sign-in form", 403 + code `not_admin`
 * means "signed in, but this account has not been granted access".
 * Registration is open, so the 403 case is the normal state of a new account.
 */
export function requireAdmin(auth: Auth): RequestHandler {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = await currentUser(auth, req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: "Votre compte n'a pas encore accès à l'administration.",
        code: 'not_admin'
      });
    }
    // Downstream routes need the actor's identity to refuse self-demotion and
    // self-deletion; res.locals is already a per-request bag.
    res.locals.user = user;
    next();
  });
}
