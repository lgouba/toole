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

export type BroadcastTarget = 'all' | 'clients' | 'drivers';

/**
 * Envoie une notification a TOUS les users matching la cible.
 * - all : tous les users (client + driver)
 * - clients : userType=client uniquement
 * - drivers : userType=driver uniquement
 *
 * Batche par 100 tokens (limite Expo Push API).
 * Retourne le compte de succes / echecs (pour stats).
 */
export async function broadcastPush(args: {
  title: string;
  body: string;
  target: BroadcastTarget;
  data?: Record<string, unknown>;
}): Promise<{ sent: number; failed: number; tokenCount: number }> {
  // Filtre user par type selon la cible
  const userTypeFilter =
    args.target === 'clients'
      ? { userType: 'client' as const }
      : args.target === 'drivers'
        ? { userType: 'driver' as const }
        : {};

  const tokens = await prisma.pushToken.findMany({
    where: {
      user: { ...userTypeFilter, isActive: true },
    },
    select: { id: true, token: true, userId: true },
  });

  if (!tokens.length) {
    logger.info({ target: args.target }, 'broadcastPush: no tokens to send to');
    return { sent: 0, failed: 0, tokenCount: 0 };
  }

  const data = { type: 'broadcast', ...(args.data ?? {}) };
  let sent = 0;
  let failed = 0;
  // Expo limite a 100 notifs par requete
  const BATCH = 100;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const slice = tokens.slice(i, i + BATCH);
    const messages: ExpoPushMessage[] = slice.map((t) => ({
      to: t.token,
      title: args.title,
      body: args.body,
      data,
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
        logger.warn(
          { status: res.status, body: text },
          'broadcastPush batch failed',
        );
        failed += slice.length;
        continue;
      }
      const json = (await res.json()) as {
        data?: Array<{
          status: 'ok' | 'error';
          details?: { error?: string };
        }>;
      };
      if (!json.data) {
        failed += slice.length;
        continue;
      }
      for (let j = 0; j < json.data.length; j++) {
        const r = json.data[j];
        const t = slice[j];
        if (r.status === 'ok') {
          sent++;
        } else {
          failed++;
          // Nettoyer les tokens invalides
          if (r.details?.error === 'DeviceNotRegistered' && t) {
            await prisma.pushToken
              .delete({ where: { id: t.id } })
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'broadcastPush batch exception');
      failed += slice.length;
    }
  }

  logger.info(
    { target: args.target, sent, failed, tokenCount: tokens.length },
    'broadcastPush done',
  );
  return { sent, failed, tokenCount: tokens.length };
}
