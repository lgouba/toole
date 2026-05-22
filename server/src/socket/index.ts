import { Server as HttpServer } from 'http';
import { Server as IoServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { env } from '../config/env.js';
import { setIo, userRoom, ADMIN_ROOM } from '../services/notification.service.js';
import { registerSocketHandlers } from './handlers.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    userType: string;
  };
}

/**
 * Compteur des connexions / deconnexions par utilisateur depuis le demarrage
 * du process. Permet de detecter rapidement les utilisateurs qui ont une
 * connexion socket instable (utile pour debug / support).
 *
 * Reset au reboot du serveur : c'est intentionnel, on veut un instantane.
 * Pour de l'historique long-terme il faudrait persister en DB.
 */
interface SocketStats {
  fullName: string | null;
  userType: string;
  connectCount: number;
  disconnectCount: number;
  lastConnectAt: Date | null;
  lastDisconnectAt: Date | null;
  lastDisconnectReason: string | null;
  /** sessionStart -> sessionEnd, ms total online */
  totalOnlineMs: number;
  /** ms entre la derniere connexion et maintenant (si pas deconnecte) */
  currentSessionStart: Date | null;
}

const userStats = new Map<string, SocketStats>();

/**
 * Resolution lazy du fullName pour ne pas charger la DB a chaque connect.
 * Cache au premier appel.
 */
async function getUserFullName(userId: string): Promise<string | null> {
  const existing = userStats.get(userId);
  if (existing?.fullName) return existing.fullName;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    return user?.fullName ?? null;
  } catch {
    return null;
  }
}

function getOrCreateStats(userId: string, userType: string): SocketStats {
  let stats = userStats.get(userId);
  if (!stats) {
    stats = {
      fullName: null,
      userType,
      connectCount: 0,
      disconnectCount: 0,
      lastConnectAt: null,
      lastDisconnectAt: null,
      lastDisconnectReason: null,
      totalOnlineMs: 0,
      currentSessionStart: null,
    };
    userStats.set(userId, stats);
  }
  return stats;
}

/**
 * Endpoint helper : retourne un snapshot des stats socket pour exposition
 * eventuelle via une route admin (GET /admin/socket-stats par exemple).
 */
export function getSocketStatsSnapshot() {
  const now = Date.now();
  return Array.from(userStats.entries()).map(([userId, s]) => ({
    userId,
    fullName: s.fullName,
    userType: s.userType,
    connectCount: s.connectCount,
    disconnectCount: s.disconnectCount,
    lastConnectAt: s.lastConnectAt,
    lastDisconnectAt: s.lastDisconnectAt,
    lastDisconnectReason: s.lastDisconnectReason,
    totalOnlineMs:
      s.totalOnlineMs +
      (s.currentSessionStart ? now - s.currentSessionStart.getTime() : 0),
    currentlyConnected: !!s.currentSessionStart,
  }));
}

export function initSocket(httpServer: HttpServer): IoServer {
  const io = new IoServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
    },
    // ⚡ Detection rapide des sockets morts (reseau flaky BF).
    // Defaults socket.io : pingInterval=25s, pingTimeout=20s → jusqu'a 45s
    // avant qu'un socket mort soit detecte → le livreur ne reçoit aucune
    // course pendant ce temps. On serre la vis :
    //   - ping toutes les 10s (charge negligeable)
    //   - timeout 8s avant de considerer mort
    // → max 18s entre "le socket meurt" et "le client tente une reconnexion"
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization as string | undefined)?.replace(
          /^Bearer\s+/i,
          '',
        );
      if (!token) return next(new Error('Missing auth token'));
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data.userId = payload.userId;
      (socket as AuthedSocket).data.userType = payload.userType;
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket auth failed');
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const authed = socket as AuthedSocket;
    const { userId, userType } = authed.data;
    socket.join(userRoom(userId));
    if (userType === 'admin') {
      socket.join(ADMIN_ROOM);
    }

    // --- Tracking stats ---
    const stats = getOrCreateStats(userId, userType);
    stats.connectCount++;
    stats.lastConnectAt = new Date();
    stats.currentSessionStart = stats.lastConnectAt;
    // Resolution async du fullName (cache pour la suite)
    if (!stats.fullName) {
      stats.fullName = await getUserFullName(userId);
    }

    logger.info(
      {
        userId,
        fullName: stats.fullName,
        userType,
        socketId: socket.id,
        connectCount: stats.connectCount,
        disconnectCount: stats.disconnectCount,
      },
      'Socket connected',
    );
    registerSocketHandlers(authed);

    // A la (re)connexion d'un livreur, on lui pousse les courses pending dans
    // sa zone qu'il aurait pu manquer pendant qu'il etait deconnecte
    // (app en background, reseau coupe, etc.). Sans ca, le livreur reste sur
    // l'ecran d'accueil sans rien voir alors qu'une demande existe.
    if (userType === 'driver') {
      void (async () => {
        try {
          const { prisma } = await import('../lib/prisma.js');
          const { notifyPendingDeliveriesToDriver } = await import(
            '../services/driver.service.js'
          );
          const profile = await prisma.driverProfile.findUnique({
            where: { userId },
            select: { isOnline: true, currentLat: true, currentLng: true },
          });
          if (
            profile?.isOnline &&
            profile.currentLat != null &&
            profile.currentLng != null
          ) {
            await notifyPendingDeliveriesToDriver(
              userId,
              profile.currentLat,
              profile.currentLng,
            );
          }
        } catch (err) {
          logger.warn(
            { err, userId },
            'Failed to replay pending deliveries on socket connect',
          );
        }
      })();
    }

    socket.on('disconnect', (reason) => {
      const s = userStats.get(userId);
      if (!s) return;
      s.disconnectCount++;
      const now = new Date();
      s.lastDisconnectAt = now;
      s.lastDisconnectReason = reason;
      if (s.currentSessionStart) {
        s.totalOnlineMs += now.getTime() - s.currentSessionStart.getTime();
        s.currentSessionStart = null;
      }

      // Niveau warn si le user enchaine les deconnexions (signe d'un reseau
      // instable cote client : ca aide le support a identifier les problemes).
      const isFlaky = s.disconnectCount >= 5;
      const logFn = isFlaky ? logger.warn.bind(logger) : logger.info.bind(logger);
      logFn(
        {
          userId,
          fullName: s.fullName,
          userType: s.userType,
          socketId: socket.id,
          reason,
          disconnectCount: s.disconnectCount,
          connectCount: s.connectCount,
          totalOnlineSec: Math.round(s.totalOnlineMs / 1000),
          flaky: isFlaky,
        },
        isFlaky
          ? 'Socket disconnected (flaky connection detected)'
          : 'Socket disconnected',
      );
    });
  });

  setIo(io);
  return io;
}
