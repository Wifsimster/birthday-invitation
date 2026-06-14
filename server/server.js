import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createApp } from './src/app.js';
import { openDb, initSchema, defaultDbPath } from './src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// The built SPA lives next to the server (../dist). When present, this single
// process serves it alongside the API — no Caddy / supervisord needed.
function resolveStaticDir() {
    if (process.env.STATIC_DIR) return process.env.STATIC_DIR;
    const dist = path.join(__dirname, '..', 'dist');
    return fs.existsSync(path.join(dist, 'index.html')) ? dist : undefined;
}

async function main() {
    const dbPath = defaultDbPath();
    const db = await openDb(dbPath);
    await initSchema(db);
    console.log(`Connected to SQLite database at: ${dbPath}`);

    const staticDir = resolveStaticDir();
    const app = createApp(db, { staticDir });

    const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(staticDir ? `📦 Serving SPA from ${staticDir}` : '📦 API only (no static dir found)');
    });

    const shutdown = async (signal) => {
        console.log(`Received ${signal}, shutting down...`);
        server.close(async () => {
            try {
                await db.close();
                console.log('Database connection closed.');
            } catch (err) {
                console.error(err.message);
            }
            process.exit(0);
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
