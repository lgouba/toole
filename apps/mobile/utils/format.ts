import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Formate un montant dans la monnaie configurée depuis l'admin.
 * (Rétrocompat : la fonction s'appelle encore formatCFA même si la monnaie
 * peut maintenant être autre chose qu'FCFA.)
 */
export function formatCFA(amount: number): string {
  const { settings } = useSettingsStore.getState();
  const formatted = amount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${settings.currency}`;
}

export function formatPhone(phone: string): string {
  // Format: +226 70 12 34 56
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('226')) {
    const local = cleaned.slice(3);
    return `+226 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
  }
  if (cleaned.length === 8) {
    return `+226 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
  }
  return phone;
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm', { locale: fr });
}

export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'dd MMM yyyy a HH:mm', { locale: fr });
}

export function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formate une durée ETA en texte lisible :
 *   < 1 min   -> "< 1 min"
 *   < 1 h     -> "12 min"
 *   >= 1 h    -> "1 h 15"
 */
export function formatEta(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins}`;
}
