import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DeliveryStatus } from '@/types';
import { ShipmentBucket } from '@/theme/recapTokens';

/** "il y a 8 minutes", "il y a 3 jours"… (FR, suffixé). */
export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

/** Mappe un statut backend (granulaire) vers un bucket UI (3 catégories). */
export function toBucket(status: DeliveryStatus): ShipmentBucket {
  switch (status) {
    case 'delivered':
      return 'livree';
    case 'cancelled':
    case 'expired':
      return 'annulee';
    default:
      // scheduled, pending, accepted, picking_up, picked_up, delivering
      return 'en_cours';
  }
}
