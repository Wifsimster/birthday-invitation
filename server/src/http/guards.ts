import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { type Auth, DEFAULT_ROLE, isRole, type SessionUser } from '../auth.ts';
import { asyncHandler } from './async-handler.ts';

export async function currentUser(auth: Auth, req: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const user = session.user as unknown as Omit<SessionUser, 'role'> & { role?: unknown };
  return { ...user, role: isRole(user.role) ? user.role : DEFAULT_ROLE };
}

export function actor(res: Response): SessionUser {
  return res.locals.user as SessionUser;
}

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
    res.locals.user = user;
    next();
  });
}
