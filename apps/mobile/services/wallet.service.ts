import { api, unwrap } from './api.client';

export interface WalletSnapshot {
  balance: number;
  commissionDebt: number;
  /** Somme des topups déjà initiés et en attente de validation admin. */
  pendingTopupAmount: number;
  /** Dette commission restante après soustraction des pending. C'est le
   *  maximum que le livreur peut encore reverser MAINTENANT. */
  effectiveDebt: number;
  totalDeliveries: number;
  /** Cumul à vie des gains livreur (cash + wallet confondus). */
  totalEarned: number;
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
  /** Pour une ligne commission_debt : date d'imputation intégrale par des
   *  reversements (FIFO). null = encore due. */
  settledAt: string | null;
  delivery?: {
    reference: string;
    status: string;
    /** Prix total payé par le client (pour affichage récap dans l'historique). */
    price?: number;
    driverCommission?: number | null;
    platformFee?: number | null;
  } | null;
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


/** Formate un numéro 226XXXXXXXX en "XX XX XX XX" */
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
  commission_debt: 'Commission à reverser',
  tip: 'Pourboire',
  topup: 'Reversement commission',
  withdrawal: 'Versement reçu',
  withdrawal_fee: 'Frais de retrait',
  adjustment: 'Ajustement',
};

/**
 * Nature d'une ligne d'activité pour l'affichage (couleur + sens) :
 *  - 'gain'      : crédit livreur (gain, pourboire) — vert +
 *  - 'reverse'   : commission cash que le livreur DOIT à la plateforme — ambre
 *  - 'payout'    : versement/retrait reçu par le livreur — bleu (sorti)
 *  - 'remit'     : reversement effectué par le livreur (règle sa dette) — bleu
 *  - 'neutral'   : le reste
 */
export type TxNature = 'gain' | 'reverse' | 'payout' | 'remit' | 'neutral';
export function txNature(type: Transaction['type']): TxNature {
  switch (type) {
    case 'commission':
    case 'tip':
      return 'gain';
    case 'commission_debt':
      return 'reverse';
    case 'withdrawal':
    case 'withdrawal_fee':
      return 'payout';
    case 'topup':
      return 'remit';
    default:
      return 'neutral';
  }
}

/**
 * Élément d'affichage du fil d'activité. Une course CASH produit 2 transactions
 * (commission +gain ET commission_debt −commission) : on les REGROUPE en une
 * seule entrée « course » pour lever l'ambiguïté. Le reste = ligne simple.
 */
export type ActivityItem =
  | {
      kind: 'course';
      id: string;
      reference: string | null;
      createdAt: string;
      gain: number; // part livreur (montant crédité / net gagné)
      commission: number; // commission due à la plateforme (0 si course wallet)
      isCash: boolean; // true = payée cash (commission à reverser), false = versée au wallet
      settled: boolean; // true = commission déjà reversée (imputation FIFO serveur)
    }
  | { kind: 'single'; tx: Transaction };

/**
 * Transforme la liste plate de transactions en éléments d'affichage :
 * une COURSE = une seule ligne. Pour une course cash, on apparie le gain
 * (commission +) et la commission due (commission_debt −) du même deliveryId.
 * Pour une course wallet, il n'y a qu'un gain (pas de dette).
 */
export function buildActivityItems(txs: Transaction[]): ActivityItem[] {
  // Index des dettes de commission par deliveryId (course cash).
  const debtByDelivery = new Map<string, Transaction>();
  for (const t of txs) {
    if (t.type === 'commission_debt' && t.deliveryId) {
      debtByDelivery.set(t.deliveryId, t);
    }
  }
  const consumed = new Set<string>();
  const items: ActivityItem[] = [];
  for (const t of txs) {
    if (consumed.has(t.id)) continue;
    // Le gain d'une course -> ligne "course" (cash: avec dette jumelle ; wallet: seul).
    if (t.type === 'commission' && t.deliveryId) {
      const debt = debtByDelivery.get(t.deliveryId);
      const isCash = t.paymentMethod === 'cash' || !!debt;
      consumed.add(t.id);
      if (debt) consumed.add(debt.id);
      items.push({
        kind: 'course',
        id: t.deliveryId,
        reference: t.delivery?.reference ?? debt?.delivery?.reference ?? null,
        createdAt: t.createdAt,
        gain: Math.abs(t.amount),
        commission: debt ? Math.abs(debt.amount) : 0,
        isCash,
        settled: !!debt?.settledAt,
      });
      continue;
    }
    items.push({ kind: 'single', tx: t });
  }
  return items;
}
