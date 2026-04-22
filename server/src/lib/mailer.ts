import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let transporter: Transporter | null = null;
let initAttempted = false;

function getTransporter(): Transporter | null {
  if (initAttempted) return transporter;
  initAttempted = true;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    logger.warn('SMTP not configured, emails will be skipped');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true = SSL (port 465), false = STARTTLS (port 587)
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  // Verification non bloquante
  transporter.verify((err) => {
    if (err) {
      logger.error({ err }, 'SMTP connection failed');
    } else {
      logger.info({ host: env.SMTP_HOST }, 'SMTP ready');
    }
  });

  return transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to: params.to, subject: params.subject }, '[DEV] Email skipped');
    return;
  }

  try {
    await t.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    logger.info({ to: params.to, subject: params.subject }, 'Email sent');
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send email');
  }
}

/** Notification d'alerte vers l'adresse admin configuree. No-op si non configuree. */
export async function sendAdminAlert(subject: string, html: string, text?: string) {
  if (!env.ADMIN_ALERT_EMAIL) {
    logger.debug('ADMIN_ALERT_EMAIL not set, skipping admin alert');
    return;
  }
  await sendEmail({ to: env.ADMIN_ALERT_EMAIL, subject, html, text });
}
