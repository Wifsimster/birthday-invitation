import pino from 'pino';

// Shared structured logger. Level is configurable via LOG_LEVEL (default info).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info'
});

export type Logger = pino.Logger;
