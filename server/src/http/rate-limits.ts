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
  login: RequestHandler;
  email: RequestHandler;
  rsvp: RequestHandler;
  lookup: RequestHandler;
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

    admin: rateLimit({
      windowMs: options.adminWindowMs ?? MINUTES_15,
      max: options.adminMax ?? 300,
      message: TOO_MANY
    })
  };
}
