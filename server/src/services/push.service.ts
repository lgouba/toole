import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  badge?: number;
}

export async function registerPushToken(userId: string, token: string, platform?: string) {
  logger.info(
    { userId, platform, tokenPrefix: token.slice(0, 25) },
    'Registering push token',
  );
  const saved = await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform, updatedAt: new Date() },
  });
  logger.info({ id: saved.id, userId }, 'Push token saved');
  return saved;
}

export async function unregisterPushToken(token: string) {
  await prisma.pushToken.deleteMany({ where: { token } }).catch(() => {});
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  if (!tokens.length) {
    logger.warn({ userId, title }, 'sendPushToUser: no tokens registered for user');
    return;
  }
  logger.info(
    { userId, title, tokenCount: tokens.length },
    'Sending push notification',
  );

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: data ?? {},
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: text }, 'Expo push send failed');
      return;
    }
    const json = (await res.json()) as {
      data?: Array<{ status: 'ok' | 'error'; message?: string; details?: { error?: string } }>;
    };
    // Nettoyer les tokens invalides
    if (json.data) {
      for (let i = 0; i < json.data.length; i++) {
        const r = json.data[i];
        const t = tokens[i];
        if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' && t) {
          await prisma.pushToken.delete({ where: { id: t.id } }).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Expo push send exception');
  }
}
