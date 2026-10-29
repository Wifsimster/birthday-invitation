import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import type Database from 'better-sqlite3';
import { logger as defaultLogger, type Logger } from './logger.ts';
import { createMailer, type Mailer } from './mailer.ts';
import { verificationEmail, resetPasswordEmail } from './emails.ts';

export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = 'user';

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  role: Role;
}

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface CreateAuthOptions {
  secret?: string;
  baseURL?: string;
  trustedOrigins?: string[];
  google?: GoogleCredentials | null;
  mailer?: Mailer;
  requireEmailVerification?: boolean;
  logger?: Logger;
}

export function googleCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): GoogleCredentials | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

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
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send(verificationEmail(user.email, url, user.name));
      }
    },
    account: {
      accountLinking: {
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

export type Auth = ReturnType<typeof createAuth>;

export async function migrateAuth(auth: Auth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

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
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: 'credential',
    accountId: created.id,
    password: await ctx.password.hash(password)
  });
  logger.info({ email }, 'seeded admin account');
  return true;
}
