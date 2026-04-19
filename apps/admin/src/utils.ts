import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatCFA(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

export function formatDate(d: string | Date): string {
  return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: fr });
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
