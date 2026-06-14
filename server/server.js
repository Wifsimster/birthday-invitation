import { createApp } from './src/app.js';
import { openDb, initSchema, defaultDbPath } from './src/db.js';

const PORT = process.env.PORT || 3001;

async function main() {
    const dbPath = defaultDbPath();
    const db = await openDb(dbPath);
    await initSchema(db);
    console.log(`Connected to SQLite database at: ${dbPath}`);

    const app = createApp(db);

    const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
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
