import { create } from 'zustand';
import { Message } from '@/types';
import * as messageService from '@/services/message.service';

interface MessageState {
  /** Messages par course (ordre chronologique). */
  byDelivery: Record<string, Message[]>;
  /** Compteur de non-lus par course (pour le badge du bouton Message). */
  unread: Record<string, number>;
  loading: Record<string, boolean>;

  load: (deliveryId: string) => Promise<void>;
  send: (deliveryId: string, body: string) => Promise<Message | null>;
  /** Insère un message reçu (socket) en évitant les doublons. */
  receive: (message: Message, currentUserId?: string) => void;
  markRead: (deliveryId: string) => void;
  clearUnread: (deliveryId: string) => void;
  reset: () => void;
}

/** Insère/merge un message dans une liste triée par date, sans doublon d'id. */
function upsert(list: Message[], message: Message): Message[] {
  if (list.some((m) => m.id === message.id)) {
    return list.map((m) => (m.id === message.id ? message : m));
  }
  const next = [...list, message];
  next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return next;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  byDelivery: {},
  unread: {},
  loading: {},

  load: async (deliveryId) => {
    set((s) => ({ loading: { ...s.loading, [deliveryId]: true } }));
    try {
      const messages = await messageService.listMessages(deliveryId);
      set((s) => ({
        byDelivery: { ...s.byDelivery, [deliveryId]: messages },
        // Ouvrir le fil = tout est lu (le serveur l'a aussi marqué).
        unread: { ...s.unread, [deliveryId]: 0 },
        loading: { ...s.loading, [deliveryId]: false },
      }));
    } catch (err) {
      console.warn('[messages] load failed', err);
      set((s) => ({ loading: { ...s.loading, [deliveryId]: false } }));
    }
  },

  send: async (deliveryId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return null;
    try {
      const message = await messageService.sendMessage(deliveryId, trimmed);
      // L'event socket `message:new` arrivera aussi ; `receive` dédoublonne.
      set((s) => ({
        byDelivery: {
          ...s.byDelivery,
          [deliveryId]: upsert(s.byDelivery[deliveryId] ?? [], message),
        },
      }));
      return message;
    } catch (err) {
      console.warn('[messages] send failed', err);
      throw err;
    }
  },

  receive: (message, currentUserId) => {
    const deliveryId = message.deliveryId;
    set((s) => {
      const list = upsert(s.byDelivery[deliveryId] ?? [], message);
      const isIncoming =
        !!currentUserId && message.recipientId === currentUserId && !message.readAt;
      const already = s.byDelivery[deliveryId]?.some((m) => m.id === message.id);
      const unreadCount =
        (s.unread[deliveryId] ?? 0) + (isIncoming && !already ? 1 : 0);
      return {
        byDelivery: { ...s.byDelivery, [deliveryId]: list },
        unread: { ...s.unread, [deliveryId]: unreadCount },
      };
    });
  },

  markRead: (deliveryId) => {
    set((s) => ({ unread: { ...s.unread, [deliveryId]: 0 } }));
    void messageService.markRead(deliveryId).catch(() => {});
  },

  clearUnread: (deliveryId) =>
    set((s) => ({ unread: { ...s.unread, [deliveryId]: 0 } })),

  reset: () => set({ byDelivery: {}, unread: {}, loading: {} }),
}));
