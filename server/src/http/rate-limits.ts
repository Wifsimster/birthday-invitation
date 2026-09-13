// Every rate limiter the API installs, and the knobs tests turn down.
//
// Grouping them here makes the ceilings comparable at a glance — which is the
// only way to notice that the dashboard's own polling would outrun the admin
// limiter, or that an endpoint sending mail to a caller-chosen address is
// throttled like an ordinary read.

import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  globalWindowMs?: number;
  globalMax?: number;
  rsvpWindowMs?: number;
  rsvpMax?: number;
  lookupWindowMs?: number;
  lookupMax?: number;
  adminWindowMs?: number;
  adminMax?: number;
  loginMax?: number;
  signupWindowMs?: number;
  signupMax?: number;
}

export interface Limiters {
  global: RequestHandler;
  /** Sign-in attempts. */
  login: RequestHandler;
  /** Endpoints that email an address chosen by the caller (spam amplifiers). */
  email: RequestHandler;
  /** Public RSVP submissions. */
  rsvp: RequestHandler;
  /** The public phone-lookup oracle, to blunt enumeration. */
  lookup: RequestHandler;
  /** Authenticated management routes. */
  admin: RequestHandler;
}

const MINUTES_15 = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const TOO_MANY = { error: 'Trop de tentatives, veuillez réessayer plus tard.' };

export function createLimiters(options: RateLimitOptions = {}): Limiters {
  return {
    global: rateLimit({
      windowMs: options.globalWindowMs ?? MINUTES_15,
      max: options.globalMax ?? 300
    }),

    login: rateLimit({
      windowMs: options.adminWindowMs ?? MINUTES_15,
      max: options.loginMax ?? 20,
      message: TOO_MANY
    }),

    // Throttled harder than sign-in, and per-IP like the rest.
    email: rateLimit({
      windowMs: options.signupWindowMs ?? HOUR,
      max: options.signupMax ?? 10,
      message: TOO_MANY
    }),

    rsvp: rateLimit({
      windowMs: options.rsvpWindowMs ?? HOUR,
      max: options.rsvpMax ?? 5,
      message: { error: 'Trop de tentatives de réponse, veuillez réessayer plus tard.' }
    }),

    lookup: rateLimit({
      windowMs: options.lookupWindowMs ?? HOUR,
      max: options.lookupMax ?? 20,
      message: { error: 'Trop de recherches, veuillez réessayer plus tard.' }
    }),

    // A backstop against a runaway client rather than the primary control —
    // these routes are already behind an authenticated session. The dashboard
    // polls every 30s (events + the selected event's counts and RSVPs), which is
    // ~90 requests per 15 minutes on its own, so a ceiling of 100 meant a second
    // open tab started collecting 429s.
    admin: rateLimit({
      windowMs: options.adminWindowMs ?? MINUTES_15,
      max: options.adminMax ?? 300,
      message: TOO_MANY
    })
  };
}
