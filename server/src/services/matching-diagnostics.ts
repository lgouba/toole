/**
 * Diagnostic de matching : pourquoi une course n'a trouvé aucun livreur à notifier.
 *
 * Fonction PURE (aucune dépendance DB/Prisma) pour rester testable sans base.
 * Utilisée par `notifyNearbyDrivers` (delivery.service) pour décider s'il faut
 * remonter une alerte Sentry et avec quelle raison.
 */

export type NoMatchReason = 'no_one_online' | 'online_but_filtered' | 'all_busy';

export interface NoMatchInput {
  /** Nombre de livreurs retournés par findNearbyDrivers (en ligne + position fraîche + dans le rayon). */
  nearbyCount: number;
  /** Nombre de livreurs opérationnels EN LIGNE (isOnline + activés + KYC exploitable), indépendamment de position/fraîcheur. */
  onlineCount: number;
  /** Nombre de livreurs réellement éligibles après filtre occupé/chaînage. */
  eligibleCount: number;
}

export interface NoMatchClassification {
  report: boolean;
  reason: NoMatchReason;
}

/**
 * Renvoie la classification de l'échec de matching, ou `null` s'il y a au moins
 * un livreur éligible (cas nominal : rien à signaler).
 *
 * - nearbyCount === 0 :
 *     onlineCount > 0  -> 'online_but_filtered' (des livreurs en ligne mais écartés :
 *                         position périmée, hors zone ou inactif → LE signal du bug récurrent)
 *     onlineCount === 0 -> 'no_one_online' (personne en ligne : attendu, mais tracé groupé)
 * - nearbyCount > 0 && eligibleCount === 0 -> 'all_busy' (proches mais tous occupés au-delà du chaînage)
 * - eligibleCount > 0 -> null
 */
export function classifyNoMatch(input: NoMatchInput): NoMatchClassification | null {
  const { nearbyCount, onlineCount, eligibleCount } = input;

  if (nearbyCount === 0) {
    return {
      report: true,
      reason: onlineCount > 0 ? 'online_but_filtered' : 'no_one_online',
    };
  }

  if (eligibleCount === 0) {
    return { report: true, reason: 'all_busy' };
  }

  return null;
}
