import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import type Database from 'better-sqlite3';
import { logger as defaultLogger, type Logger } from './logger.ts';
import { createMailer, type Mailer } from './mailer.ts';
import { verificationEmail, resetPasswordEmail } from './emails.ts';

// The two roles the app knows about. `admin` reaches the event/RSVP management
// API; `user` is a registered account with no access until an admin grants it.
export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = 'user';

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface CreateAuthOptions {
  // Signing secret for sessions/cookies. Required in production — Better Auth
  // falls back to a low-entropy dev default (with a warning) when unset.
  secret?: string;
  // Canonical public origin (e.g. https://birthday.example.com). When unset
  // Better Auth infers it from the (proxy-aware) request headers.
  baseURL?: string;
  // Extra origins allowed to drive auth flows (defaults to same-origin only).
  trustedOrigins?: string[];
  // Google OAuth client. Omitted (or unset in the env) disables the provider —
  // the sign-in page hides the button when /api/auth/providers reports it off.
  google?: GoogleCredentials | null;
  // Transport for verification / password-reset mail.
  mailer?: Mailer;
  // Require a confirmed email before a session can be created. Defaults on;
  // tests turn it off to sign in without a mail round-trip.
  requireEmailVerification?: boolean;
  logger?: Logger;
}

/** Read the Google OAuth client from the environment, or null when unset. */
export function googleCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): GoogleCredentials | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Build the Better Auth instance backed by the existing better-sqlite3 handle.
 *
 * Two sign-in methods are enabled: email/password with a mandatory verification
 * round-trip, and Google OAuth when credentials are configured. Registration is
 * open — anyone may create an account — but every new account lands on the
 * `user` role, which grants nothing. An existing admin promotes accounts from
 * the admin UI; the env-seeded ADMIN_EMAIL is the bootstrap admin.
 *
 * `role` is declared with `input: false` so it can never be set through the
 * public sign-up body — a client that posts `{ role: 'admin' }` is ignored.
 */
export function createAuth(database: Database.Database, options: CreateAuthOptions = {}) {
  const {
    secret = process.env.BETTER_AUTH_SECRET,
    baseURL = process.env.BETTER_AUTH_URL || undefined,
    trustedOrigins,
    google = googleCredentialsFromEnv(),
    logger = defaultLogger,
    mailer = createMailer(undefined, logger),
    requireEmailVerification = true
  } = options;

  return betterAuth({
    database,
    ...(secret ? { secret } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(trustedOrigins && trustedOrigins.length ? { trustedOrigins } : {}),
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: DEFAULT_ROLE,
          // Never accepted from a request body — only the server-side seed and
          // the admin-guarded role route write this column.
          input: false
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send(resetPasswordEmail(user.email, url, user.name));
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      // Land the user in a usable session straight from the email link rather
      // than bouncing them back to the sign-in form to retype their password.
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send(verificationEmail(user.email, url, user.name));
      }
    },
    account: {
      accountLinking: {
        // A Google sign-in may adopt an existing email/password account only
        // when that local account is itself verified (Better Auth's default),
        // which stops someone pre-registering an unverified account at another
        // person's address to capture their Google identity.
        enabled: true,
        trustedProviders: ['google']
      }
    },
    ...(google
      ? {
          socialProviders: {
            google: {
              clientId: google.clientId,
              clientSecret: google.clientSecret
            }
          }
        }
      : {})
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
 * Idempotently seed the bootstrap admin from the environment.
 *
 * Creates the account when missing, then — on every boot — makes sure it is
 * marked `role: 'admin'` and `emailVerified`, so the operator can never lock
 * themselves out (an unverified seeded admin could not sign in, and there
 * would be nobody left to grant the role). The password of an existing account
 * is never touched, so restarts don't reset it.
 *
 * The account is written through the internal adapter rather than the public
 * sign-up API on purpose: sign-up would email the operator a verification link
 * for an address we are about to mark verified anyway, and would need SMTP to
 * be reachable before the app can have an admin at all.
 *
 * Returns true when a new account was created.
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
    const user = existing.user as unknown as { id: string; role?: string; emailVerified?: boolean };
    const patch: Record<string, unknown> = {};
    if (user.role !== 'admin') patch.role = 'admin';
    if (!user.emailVerified) patch.emailVerified = true;
    if (Object.keys(patch).length) {
      await ctx.internalAdapter.updateUser(user.id, patch);
      logger.info({ email, patch }, 'repaired admin account');
    } else {
      logger.info({ email }, 'admin account already present');
    }
    return false;
  }

  const created = await ctx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
    role: 'admin'
  });
  // The credential account carries the password hash; without it the admin
  // exists but cannot sign in with a password.
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: 'credential',
    accountId: created.id,
    password: await ctx.password.hash(password)
  });
  logger.info({ email }, 'seeded admin account');
  return true;
}
