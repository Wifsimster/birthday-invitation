import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import type Database from 'better-sqlite3';
import { logger as defaultLogger, type Logger } from './logger.ts';

export interface CreateAuthOptions {
  // Signing secret for sessions/cookies. Required in production — Better Auth
  // falls back to a low-entropy dev default (with a warning) when unset.
  secret?: string;
  // Canonical public origin (e.g. https://leo-birthday.example.com). When unset
  // Better Auth infers it from the (proxy-aware) request headers.
  baseURL?: string;
  // Extra origins allowed to drive auth flows (defaults to same-origin only).
  trustedOrigins?: string[];
}

/**
 * Build the Better Auth instance backed by the existing better-sqlite3 handle.
 *
 * Email/password is the only enabled method: there are no social providers and
 * email verification is off, since the single admin account is seeded from the
 * environment rather than self-registered. Public self-service sign-up is
 * blocked at the HTTP layer (see app.ts); `disableSignUp` stays false so the
 * server-side seed (`seedAdminUser`) can still create that one account.
 */
export function createAuth(database: Database.Database, options: CreateAuthOptions = {}) {
  const {
    secret = process.env.BETTER_AUTH_SECRET,
    baseURL = process.env.BETTER_AUTH_URL || undefined,
    trustedOrigins
  } = options;

  return betterAuth({
    database,
    ...(secret ? { secret } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(trustedOrigins && trustedOrigins.length ? { trustedOrigins } : {}),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8
    }
  });
}

// The Better Auth instance type, inferred from our factory so it stays exact
// (a widened `ReturnType<typeof betterAuth>` isn't assignable back to it).
export type Auth = ReturnType<typeof createAuth>;

/**
 * Create the Better Auth tables (user/session/account/verification) if missing.
 * Runs the library's own migrations so the schema always matches the installed
 * version — idempotent, safe on every boot. Shares the app's SQLite handle.
 */
export async function migrateAuth(auth: Auth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

/**
 * Idempotently seed the single admin account from the environment. Does nothing
 * when a user with that email already exists, so restarts don't fail or reset
 * the password. Returns true when a new account was created.
 */
export async function seedAdminUser(
  auth: Auth,
  email: string,
  password: string,
  name = 'Admin',
  logger: Logger = defaultLogger
): Promise<boolean> {
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing) {
    logger.info({ email }, 'admin account already present');
    return false;
  }
  await auth.api.signUpEmail({ body: { email, password, name } });
  logger.info({ email }, 'seeded admin account');
  return true;
}
