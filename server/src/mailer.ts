import nodemailer, { type Transporter } from 'nodemailer';
import { logger as defaultLogger, type Logger } from './logger.ts';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  // False when no transport is configured: send() then only logs, so local
  // development and tests work without SMTP credentials.
  enabled: boolean;
  send(message: MailMessage): Promise<void>;
}

export interface MailerConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

// Resend's SMTP bridge. The username is the literal string "resend" and the
// password is a Resend API key (re_...); MAIL_FROM must be on a domain verified
// in the Resend dashboard or the API rejects the message.
const RESEND_HOST = 'smtp.resend.com';
const RESEND_USER = 'resend';

/**
 * Read the SMTP configuration from the environment, defaulted for Resend.
 * Returns null when incomplete — the credential (RESEND_API_KEY / SMTP_PASS)
 * and MAIL_FROM are the two values that have no sensible default.
 */
export function mailerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MailerConfig | null {
  const pass = env.SMTP_PASS || env.RESEND_API_KEY;
  const from = env.MAIL_FROM;
  if (!pass || !from) return null;
  // Port 465 is implicit TLS; 587/2587 are STARTTLS. Resend serves both.
  const port = Number(env.SMTP_PORT) || 465;
  return {
    host: env.SMTP_HOST || RESEND_HOST,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    user: env.SMTP_USER || RESEND_USER,
    pass,
    from
  };
}

/**
 * A mailer that swallows every message into the log. Used when SMTP is not
 * configured so sign-up still works locally — the verification link is logged
 * instead of emailed. Never acceptable in production (see assertMailerReady).
 */
export function createNoopMailer(logger: Logger = defaultLogger): Mailer {
  return {
    enabled: false,
    async send(message) {
      logger.warn(
        { to: message.to, subject: message.subject, body: message.text },
        'SMTP not configured — email not sent, logging it instead'
      );
    }
  };
}

/**
 * Build the SMTP mailer from the environment, falling back to the no-op mailer
 * when unconfigured. Connection errors surface as a rejected send() so the
 * caller (Better Auth) reports the failure rather than silently dropping it.
 */
export function createMailer(
  config: MailerConfig | null = mailerConfigFromEnv(),
  logger: Logger = defaultLogger
): Mailer {
  if (!config) return createNoopMailer(logger);

  const transport: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });

  return {
    enabled: true,
    async send(message) {
      try {
        const info = await transport.sendMail({
          from: config.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html
        });
        logger.info({ to: message.to, subject: message.subject, messageId: info.messageId }, 'email sent');
      } catch (err) {
        // Log with the recipient for support, then rethrow: Better Auth turns
        // this into a failed sign-up rather than a silent dead end.
        logger.error({ err, to: message.to, subject: message.subject }, 'failed to send email');
        throw err;
      }
    }
  };
}
