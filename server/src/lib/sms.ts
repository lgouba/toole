import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Normalise un numero de telephone au format E.164 attendu par Africa's Talking.
 * Accepte "22670123456", "+22670123456", "70123456" (on ajoute alors le prefixe BF).
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) return `+226${digits}`;
  if (digits.startsWith('226')) return `+${digits}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
}

async function sendViaAfricasTalking(to: string, message: string): Promise<void> {
  const params = new URLSearchParams({
    username: env.AT_USERNAME!,
    to: normalizePhone(to),
    message,
  });
  if (env.AT_SENDER_ID) {
    params.append('from', env.AT_SENDER_ID);
  }

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: env.AT_API_KEY!,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '<no body>');
    throw new Error(`Africa's Talking SMS failed (${res.status}): ${txt}`);
  }

  const body: any = await res.json().catch(() => ({}));
  const recipients = body?.SMSMessageData?.Recipients ?? [];
  const first = recipients[0];
  if (!first || first.status !== 'Success') {
    throw new Error(
      `Africa's Talking SMS rejected: ${first?.status ?? 'unknown'} - ${first?.statusCode ?? ''}`,
    );
  }
  logger.info(
    { to, cost: first.cost, messageId: first.messageId },
    'SMS sent via Africa\'s Talking',
  );
}

/**
 * Envoi d'un SMS via le provider configure.
 * En mode 'dev', ne fait rien (le code OTP est log uniquement).
 */
export async function sendSms(to: string, message: string): Promise<void> {
  if (env.SMS_PROVIDER === 'dev') {
    logger.info({ to, message }, '[DEV] SMS not sent (SMS_PROVIDER=dev)');
    return;
  }

  if (env.SMS_PROVIDER === 'africastalking') {
    try {
      await sendViaAfricasTalking(to, message);
    } catch (err) {
      logger.error({ err, to }, 'Failed to send SMS via Africa\'s Talking');
      // On ne throw pas : l'utilisateur verra "code non recu" et pourra retry.
      // En dev / staging le code OTP reste dispo dans les logs.
      throw err;
    }
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${env.SMS_PROVIDER}`);
}
