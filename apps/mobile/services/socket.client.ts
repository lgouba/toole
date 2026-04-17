import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/config/api';
import { tokenStorage } from './api.client';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  const token = await tokenStorage.getAccessToken();
  if (!token) throw new Error('Not authenticated');

  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  return new Promise((resolve, reject) => {
    socket!.once('connect', () => resolve(socket!));
    socket!.once('connect_error', (err) => reject(err));
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
