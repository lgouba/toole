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

/**
 * Envoi SMS via Aqilas (https://www.aqilas.com/app/api).
 *
 * Endpoint : POST https://www.aqilas.com/api/v1/sms
 * Auth     : header X-AUTH-TOKEN = AQILAS_API_KEY
 * Body     : { from: senderId, text: message, to: ["+22670XXXXXXX"] }
 * Reponse  : 200/201 + { bulk_id } sur succes, { message } sur erreur.
 *
 * Le sender ID 'from' doit etre valide cote Aqilas (alphanumerique <=11 chars,
 * configure dans le compte Aqilas — sinon SMS rejetes / non delivres).
 */
async function sendViaAqilas(to: string, message: string): Promise<void> {
  const phone = normalizePhone(to);
  const body = {
    from: env.AQILAS_SENDER_ID,
    to: [phone],
    text: message,
  };

  const res = await fetch('https://www.aqilas.com/api/v1/sms', {
    method: 'POST',
    headers: {
      'X-AUTH-TOKEN': env.AQILAS_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = json?.message ?? `HTTP ${res.status}`;
    throw new Error(`Aqilas SMS failed: ${errMsg}`);
  }

  logger.info(
    { to: phone, bulkId: json?.bulk_id, from: env.AQILAS_SENDER_ID },
    'SMS sent via Aqilas',
  );
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
      throw err;
    }
    return;
  }

  if (env.SMS_PROVIDER === 'aqilas') {
    try {
      await sendViaAqilas(to, message);
    } catch (err) {
      logger.error({ err, to }, 'Failed to send SMS via Aqilas');
      throw err;
    }
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${env.SMS_PROVIDER}`);
}

// ============================================================
// WhatsApp via Meta Cloud API
// ============================================================
// Requiert :
//   - WHATSAPP_PHONE_NUMBER_ID (id du numero WhatsApp Business)
//   - WHATSAPP_ACCESS_TOKEN (Meta Graph API token)
//   - WHATSAPP_OTP_TEMPLATE_NAME (nom du template approuve par Meta)
//   - WHATSAPP_OTP_TEMPLATE_LANG (ex: 'fr', 'en')
//
// Si les variables ne sont pas configurees, l'appel fallback sur SMS.

async function sendViaWhatsAppCloudApi(
  to: string,
  code: string,
): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const lang = process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? 'fr';

  if (!phoneId || !token || !template) {
    throw new Error('WHATSAPP_NOT_CONFIGURED');
  }

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const recipient = normalizePhone(to).replace('+', '');

  const body = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      // Le template doit etre configure cote Meta avec 1 variable {{1}} pour l'OTP.
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '<no body>');
    throw new Error(`WhatsApp Cloud API failed (${res.status}): ${txt}`);
  }

  const json: any = await res.json().catch(() => ({}));
  logger.info(
    { to: recipient, messages: json?.messages?.length ?? 0 },
    'WhatsApp OTP sent via Meta Cloud API',
  );
}

export type MessageChannel = 'sms' | 'whatsapp';

/**
 * Envoie le message OTP via le canal demande, avec fallback automatique.
 * - channel='whatsapp' : essaye WhatsApp ; si non configure ou echec -> SMS
 * - channel='sms' : SMS uniquement
 *
 * En mode SMS_PROVIDER=dev, aucun message reel n'est envoye (le code reste
 * disponible dans les logs).
 */
export async function sendOtpMessage(
  to: string,
  code: string,
  channel: MessageChannel = 'sms',
): Promise<void> {
  const smsText = `Tollé: votre code de verification est ${code}. Valide 5 minutes.`;

  // Mode dev : on log, pas d'envoi reel
  if (env.SMS_PROVIDER === 'dev') {
    logger.info(
      { to, channel, code },
      `[DEV] OTP not sent (SMS_PROVIDER=dev), code visible in this log`,
    );
    return;
  }

  if (channel === 'whatsapp') {
    try {
      await sendViaWhatsAppCloudApi(to, code);
      return;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      logger.warn(
        { to, err: msg },
        msg === 'WHATSAPP_NOT_CONFIGURED'
          ? 'WhatsApp provider not configured, falling back to SMS'
          : 'WhatsApp send failed, falling back to SMS',
      );
      // Fallback transparent vers SMS
      await sendSms(to, smsText);
      return;
    }
  }

  // SMS par defaut
  await sendSms(to, smsText);
}
