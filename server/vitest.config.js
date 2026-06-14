import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        // Silence pino-http request logging during tests.
        env: { LOG_LEVEL: 'silent' }
    }
});
