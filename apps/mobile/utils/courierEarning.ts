import { Delivery } from '@/types';

/**
 * Rémunération du LIVREUR pour une course (≠ prix payé par le client).
 *
 * Règle Tôllé : le livreur touche `driverCommission` (= prix − commission
 * plateforme). On retombe sur `price − platformFee` si la commission n'est pas
 * fournie, puis sur `price` en dernier recours.
 *
 * ⚠️ TODO produit : confirmer si le gain affiché doit être la commission livreur
 * (par défaut ici) ou le montant complet. Point de configuration unique.
 */
export function courierEarning(d: Delivery): number {
  if (typeof d.driverCommission === 'number') return d.driverCommission;
  if (typeof d.platformFee === 'number') return Math.max(0, d.price - d.platformFee);
  return d.price;
}
