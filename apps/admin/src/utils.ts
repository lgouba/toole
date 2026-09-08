import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatCFA(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

export function formatDate(d: string | Date): string {
  return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: fr });
}

/** Variante compacte sans heure, pour les colonnes de table etroites. */
export function formatDateShort(d: string | Date): string {
  return format(new Date(d), 'dd MMM yyyy', { locale: fr });
}

export function timeAgo(d: string | Date): string {
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr });
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('226')) {
    const local = cleaned.slice(3);
    return `+226 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
  }
  return phone;
}

/** Libellé lisible d'un mode de paiement (enum PaymentMethod côté serveur). */
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Espèces',
  wallet: 'Portefeuille',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
};
export function paymentMethodLabel(m: string | null | undefined): string {
  if (!m) return '—';
  return PAYMENT_METHOD_LABEL[m] ?? m;
}

/** Libellé lisible d'un type de transaction (enum TransactionType côté serveur). */
const TX_TYPE_LABEL: Record<string, string> = {
  payment: 'Paiement',
  commission: 'Gain livraison',
  commission_debt: 'Commission plateforme',
  tip: 'Pourboire',
  topup: 'Règlement livreur',
  withdrawal: 'Retrait',
  withdrawal_fee: 'Frais retrait',
  adjustment: 'Ajustement',
};
export function txTypeLabel(t: string): string {
  return TX_TYPE_LABEL[t] ?? t;
}
