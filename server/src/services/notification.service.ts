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

/** Room dediee aux comptes admin connectes. */
export const ADMIN_ROOM = 'admins';

export function emitToAdmins(event: string, payload: unknown) {
  if (!ioInstance) return;
  ioInstance.to(ADMIN_ROOM).emit(event, payload);
}
