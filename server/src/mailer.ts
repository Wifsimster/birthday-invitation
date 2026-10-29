import nodemailer, { type Transporter } from 'nodemailer';
import { logger as defaultLogger, type Logger } from './logger.ts';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
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

const RESEND_HOST = 'smtp.resend.com';
const RESEND_USER = 'resend';

export function mailerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MailerConfig | null {
  const pass = env.SMTP_PASS || env.RESEND_API_KEY;
  const from = env.MAIL_FROM;
  if (!pass || !from) return null;
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
        logger.error({ err, to: message.to, subject: message.subject }, 'failed to send email');
        throw err;
      }
    }
  };
}
