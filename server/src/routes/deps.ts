// What every router is handed. Routers receive services and guards, never the
// database — a route that wanted to reach past its service would have to be
// given the handle on purpose.

import type { RequestHandler } from 'express';
import type { Auth } from '../auth.ts';
import type { Limiters } from '../http/rate-limits.ts';
import type { EventService } from '../services/event.service.ts';
import type { OgCardService } from '../services/og-card.service.ts';
import type { RsvpService } from '../services/rsvp.service.ts';
import type { UserService } from '../services/user.service.ts';

/** The guard chains routes mount behind. */
export interface Guards {
  /** Rate-limited, then an admin session. */
  admin: RequestHandler[];
  /**
   * Rate-limited, then *a* session: the per-event ownership check on each route
   * narrows an account to the invitations it created (an admin sees them all).
   */
  member: RequestHandler[];
}

export interface RouteDeps {
  auth: Auth;
  guards: Guards;
  limiters: Limiters;
  events: EventService;
  rsvps: RsvpService;
  users: UserService;
  ogCards: OgCardService;
}
