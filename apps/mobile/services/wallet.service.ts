import { api, unwrap } from './api.client';

export interface WalletSnapshot {
  balance: number;
  commissionDebt: number;
  totalDeliveries: number;
}

export interface Transaction {
  id: string;
  userId: string;
  deliveryId: string | null;
  type:
    | 'payment'
    | 'commission'
    | 'commission_debt'
    | 'tip'
    | 'topup'
    | 'withdrawal'
    | 'withdrawal_fee'
    | 'adjustment';
  amount: number;
  paymentMethod: 'orange_money' | 'moov_money' | 'cash' | 'wallet';
  paymentReference: string | null;
  phoneNumber: string | null;
  note: string | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  processedAt: string | null;
  delivery?: { reference: string; status: string } | null;
}

export async function getMyWallet(): Promise<WalletSnapshot> {
  const res = await api.get('/wallet');
  return unwrap<WalletSnapshot>(res);
}

export async function getMyTransactions(
  limit = 50,
  skip = 0,
): Promise<Transaction[]> {
  const res = await api.get('/wallet/transactions', {
    params: { limit, skip },
  });
  return unwrap<Transaction[]>(res);
}

export async function sendWithdrawOtp(phone: string): Promise<void> {
  await api.post('/wallet/withdraw/otp', { phone });
}

export async function requestWithdraw(args: {
  amount: number;
  phone: string;
  paymentMethod: 'orange_money' | 'moov_money';
  otpCode: string;
}): Promise<Transaction> {
  const res = await api.post('/wallet/withdraw', args);
  return unwrap<Transaction>(res);
}

export async function sendTopupOtp(phone: string): Promise<void> {
  await api.post('/wallet/topup/otp', { phone });
}

export async function requestTopup(args: {
  amount: number;
  phone: string;
  paymentMethod: 'orange_money' | 'moov_money';
  otpCode: string;
}): Promise<Transaction> {
  const res = await api.post('/wallet/topup', args);
  return unwrap<Transaction>(res);
}

/** Formate un numero 226XXXXXXXX en "XX XX XX XX" */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('226') ? digits.slice(3) : digits;
  if (local.length !== 8) return phone;
  return `${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
}

/** Labels pour l'affichage */
export const TX_TYPE_LABEL: Record<Transaction['type'], string> = {
  payment: 'Paiement',
  commission: 'Gain livraison',
  commission_debt: 'Commission plateforme',
  tip: 'Pourboire',
  topup: 'Règlement',
  withdrawal: 'Retrait',
  withdrawal_fee: 'Frais de retrait',
  adjustment: 'Ajustement',
};
