import type { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function setIo(io: Server) {
  ioInstance = io;
}

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error('Socket.IO server has not been initialised');
  }
  return ioInstance;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!ioInstance) return;
  ioInstance.to(userRoom(userId)).emit(event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  for (const id of userIds) emitToUser(id, event, payload);
}

/**
 * Ejecte immediatement tous les sockets d'un utilisateur (toutes connexions
 * dans sa room). Utilise pour la session unique : quand un livreur se connecte
 * sur un 2e appareil, on coupe le socket du 1er.
 *
 * Emet d'abord 'auth:session_revoked' pour que l'app puisse se deconnecter
 * proprement (afficher un message), puis force la deconnexion socket.
 */
export function disconnectUser(userId: string, reason = 'session_revoked') {
  if (!ioInstance) return;
  const room = userRoom(userId);
  ioInstance.to(room).emit('auth:session_revoked', { reason });
  // disconnectSockets(true) ferme aussi la couche transport sous-jacente
  ioInstance.in(room).disconnectSockets(true);
}

/** Room dediee aux comptes admin connectes. */
export const ADMIN_ROOM = 'admins';

export function emitToAdmins(event: string, payload: unknown) {
  if (!ioInstance) return;
  ioInstance.to(ADMIN_ROOM).emit(event, payload);
}
