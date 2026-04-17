export type TransactionType = 'payment' | 'commission' | 'tip' | 'topup' | 'withdrawal';

export type PaymentMethod = 'orange_money' | 'moov_money' | 'cash' | 'wallet';

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  userId: string;
  deliveryId?: string;
  type: TransactionType;
  amount: number; // FCFA
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  status: TransactionStatus;
  createdAt: string;
}

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  payment: 'Paiement',
  commission: 'Commission',
  tip: 'Pourboire',
  topup: 'Recharge',
  withdrawal: 'Retrait',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  cash: 'Especes',
  wallet: 'Portefeuille',
};
