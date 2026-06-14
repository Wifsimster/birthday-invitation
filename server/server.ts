import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.ts';
import { openDb, initSchema, defaultDbPath } from './src/db.ts';
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

function main(): void {
  const dbPath = defaultDbPath();
  const db = openDb(dbPath);
  initSchema(db);
  logger.info({ dbPath }, 'connected to SQLite database');

  const staticDir = resolveStaticDir();
  const app = createApp(db, { staticDir });

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, staticDir: staticDir ?? null }, 'server running');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
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

try {
  main();
} catch (err) {
  logger.error({ err }, 'failed to start server');
  process.exit(1);
}
