import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.ts';
import { openDb, initSchema, defaultDbPath } from './src/db.ts';
import { eventConfig, ensureDefaultEvent } from './src/event.ts';
import { createAuth, migrateAuth, seedAdminUser, googleCredentialsFromEnv } from './src/auth.ts';
import { createMailer, mailerConfigFromEnv } from './src/mailer.ts';
import { logger } from './src/logger.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// The built SPA lives next to the server (../dist). When present, this single
// process serves it alongside the API — no Caddy / supervisord needed.
function resolveStaticDir(): string | undefined {
  if (process.env.STATIC_DIR) return process.env.STATIC_DIR;
  const dist = path.join(__dirname, '..', 'dist');
  return fs.existsSync(path.join(dist, 'index.html')) ? dist : undefined;
}

async function main(): Promise<void> {
  const dbPath = defaultDbPath();
  const db = openDb(dbPath);
  initSchema(db);
  // Seed/repair the default event from the env config so env-configured
  // deployments flow their configuration into the default event row.
  ensureDefaultEvent(db, eventConfig());
  logger.info({ dbPath }, 'connected to SQLite database');

  // Authentication (Better Auth): email/password with a verification round-trip,
  // plus Google when credentials are configured.
  const isProduction = process.env.NODE_ENV === 'production';

  // Fail fast in production if the session signing secret is missing —
  // otherwise Better Auth falls back to a low-entropy default that would
  // invalidate sessions across restarts.
  if (isProduction && !process.env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET must be set in production');
  }

  // Sign-up is gated on a verification email, so an unconfigured mailer would
  // leave every new account permanently unable to sign in — with the link only
  // in the container logs. Refuse to start rather than ship that silently.
  const mailConfig = mailerConfigFromEnv();
  if (isProduction && !mailConfig) {
    throw new Error(
      'Email is not configured: set MAIL_FROM and RESEND_API_KEY (or SMTP_PASS). ' +
      'Email verification is required, so sign-up cannot complete without it.'
    );
  }
  const mailer = createMailer(mailConfig, logger);

  const google = googleCredentialsFromEnv();
  const auth = createAuth(db.raw, {
    mailer,
    google,
    trustedOrigins: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined
  });
  await migrateAuth(auth);
  logger.info(
    { google: Boolean(google), email: mailer.enabled, from: mailConfig?.from ?? null },
    'authentication configured'
  );

  // Seed the bootstrap admin from the environment (idempotent). Every other
  // account registers itself and starts with no access until promoted.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await seedAdminUser(auth, adminEmail, adminPassword, process.env.ADMIN_NAME, logger);
  } else {
    logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD unset — no admin account seeded');
  }

  const staticDir = resolveStaticDir();
  const app = createApp(db, { auth, staticDir });

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, staticDir: staticDir ?? null }, 'server running');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    // Force-exit if connections don't drain in time so the container doesn't
    // hang until Docker's SIGKILL (and db.close never runs).
    const forced = setTimeout(() => {
      logger.warn('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 5000);
    forced.unref();
    server.closeAllConnections?.();
    server.close(() => {
      clearTimeout(forced);
      try {
        db.close();
        logger.info('database connection closed');
      } catch (err) {
        logger.error({ err }, 'error closing database');
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start server');
  process.exit(1);
});
