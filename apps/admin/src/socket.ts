import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { tokenStorage } from './api';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(API_BASE_URL, {
    transports: ['websocket'],
    auth: (cb) => {
      const token = tokenStorage.get();
      cb({ token });
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
