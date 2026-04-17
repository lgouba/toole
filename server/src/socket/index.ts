import { Server as HttpServer } from 'http';
import { Server as IoServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt.js';
import { env } from '../config/env.js';
import { setIo, userRoom } from '../services/notification.service.js';
import { registerSocketHandlers } from './handlers.js';
import { logger } from '../lib/logger.js';

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    userType: string;
  };
}

export function initSocket(httpServer: HttpServer): IoServer {
  const io = new IoServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
    },
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

  io.on('connection', (socket) => {
    const authed = socket as AuthedSocket;
    const { userId } = authed.data;
    socket.join(userRoom(userId));
    logger.info({ userId, socketId: socket.id }, 'Socket connected');
    registerSocketHandlers(authed);
    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  setIo(io);
  return io;
}
