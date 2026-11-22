/**
 * Mapping type de push → catégorie de préférence utilisateur, et décision
 * d'envoi. Isolé ici (pur, sans Prisma) pour être testable.
 *
 * Catégories exposées à l'utilisateur dans Paramètres :
 * - newDeliveries   : une nouvelle course lui est proposée (livreur).
 * - deliveryUpdates : cycle de vie d'une course en cours + chat.
 * - promotions      : campagnes/broadcasts marketing.
 * - always          : compte & portefeuille — JAMAIS coupé (un retrait validé,
 *   une activation de compte doivent toujours passer).
 *
 * Défaut PERMISSIF : type inconnu ou préférences inconnues → on envoie.
 */
export type NotifCategory = 'newDeliveries' | 'deliveryUpdates' | 'promotions' | 'always';

export interface NotifPrefs {
  notifNewDeliveries: boolean;
  notifDeliveryUpdates: boolean;
  notifPromotions: boolean;
}

const TYPE_CATEGORY: Record<string, NotifCategory> = {
  // Nouvelles courses
  new_request: 'newDeliveries',
  // Suivi de la livraison (cycle de vie + codes + chat)
  delivery_accepted: 'deliveryUpdates',
  delivery_picked_up: 'deliveryUpdates',
  delivery_delivered: 'deliveryUpdates',
  scheduled_started: 'deliveryUpdates',
  status_update: 'deliveryUpdates',
  delivery_cancelled: 'deliveryUpdates',
  driver_cancelled: 'deliveryUpdates',
  pickup_code: 'deliveryUpdates',
  delivery_code: 'deliveryUpdates',
  pending_batch: 'deliveryUpdates',
  message: 'deliveryUpdates',
  // Promotions / campagnes
  broadcast: 'promotions',
  // Tout le reste (commission, tip, topup*, withdrawal*, adjustment,
  // account_activated, commission_debt…) → 'always' via le défaut.
};

export function categoryForType(type?: string | null): NotifCategory {
  if (!type) return 'always';
  return TYPE_CATEGORY[type] ?? 'always';
}

/**
 * Faut-il envoyer un push de ce type à un user ayant ces préférences ?
 * `always` passe toujours. Préférence absente/indéfinie → on envoie (permissif).
 */
export function isPushAllowed(
  type: string | null | undefined,
  prefs: Partial<NotifPrefs> | null | undefined,
): boolean {
  const cat = categoryForType(type);
  if (cat === 'always') return true;
  if (!prefs) return true;
  if (cat === 'newDeliveries') return prefs.notifNewDeliveries !== false;
  if (cat === 'deliveryUpdates') return prefs.notifDeliveryUpdates !== false;
  if (cat === 'promotions') return prefs.notifPromotions !== false;
  return true;
}
