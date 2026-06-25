import { create } from 'zustand';

export interface AdminNotification {
  id: string;
  type: 'new_driver' | 'info';
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: number;
}

interface NotifState {
  items: AdminNotification[];
  unreadCount: number;
  push: (n: Omit<AdminNotification, 'id' | 'read' | 'createdAt'>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'toole-admin:notifications';
const MAX_ITEMS = 30;

function load(): AdminNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items: AdminNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // quota depasse ou localStorage indisponible
  }
}

export const useNotifications = create<NotifState>((set, get) => ({
  items: load(),
  unreadCount: load().filter((n) => !n.read).length,

  push: (n) => {
    const notif: AdminNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: Date.now(),
    };
    const next = [notif, ...get().items].slice(0, MAX_ITEMS);
    persist(next);
    set({ items: next, unreadCount: next.filter((x) => !x.read).length });
  },

  markAllRead: () => {
    const next = get().items.map((n) => ({ ...n, read: true }));
    persist(next);
    set({ items: next, unreadCount: 0 });
  },

  markRead: (id) => {
    const next = get().items.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    persist(next);
    set({ items: next, unreadCount: next.filter((x) => !x.read).length });
  },

  clear: () => {
    persist([]);
    set({ items: [], unreadCount: 0 });
  },
}));
