import { create } from 'zustand';
import { Transaction } from '@/types';
import { api, unwrap } from '@/services/api.client';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;

  fetchBalance: () => Promise<void>;
  fetchTransactions: (userId: string) => Promise<void>;
  topUp: (userId: string, amount: number, method: 'orange_money' | 'moov_money') => Promise<void>;
  withdraw: (userId: string, amount: number, method: 'orange_money' | 'moov_money') => Promise<void>;
}

/**
 * Version simplifiee : balance recuperee via /users/me (driverProfile.walletBalance).
 * Pas d'endpoints wallet dedies dans le MVP backend.
 * Les transactions sont fictives pour le moment.
 */
export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  transactions: [],
  isLoading: false,

  fetchBalance: async () => {
    try {
      const res = await api.get('/users/me');
      const user = unwrap<any>(res);
      set({ balance: user.driverProfile?.walletBalance ?? 0 });
    } catch {
      // Keep previous balance
    }
  },

  fetchTransactions: async (_userId) => {
    // TODO: implement backend endpoint
    set({ transactions: [] });
  },

  topUp: async (_userId, _amount, _method) => {
    // TODO: implement backend endpoint
  },

  withdraw: async (_userId, _amount, _method) => {
    // TODO: implement backend endpoint
  },
}));
