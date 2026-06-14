import pino from 'pino';

// Shared structured logger. Level is configurable via LOG_LEVEL (default info).
// Redact credentials and guest PII so they never reach the log stream — the
// phone-lookup route carries the phone number in the URL path, so the request
// url is redacted alongside the Authorization header and cookies.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]'
    ],
    censor: '[redacted]'
  }
});

export type Logger = pino.Logger;
