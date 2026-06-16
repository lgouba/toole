export type DocTone = 'ok' | 'todo' | 'neutral';

/**
 * Statut "Mes documents" pour le livreur.
 *
 * Le profil auth (`/auth/me`) n'expose qu'un booléen `isVerified` (pas l'état
 * pièce par pièce ni le détail rejeté/expiré). On en dérive le chip :
 *  - vérifié   → À jour (vert)
 *  - sinon     → En vérification (neutre)
 * TODO produit : exposer le statut par pièce (CNIB/permis/assurance) côté API
 * pour distinguer « À compléter » / « À renouveler ».
 */
export function documentsStatus(isVerified: boolean): { label: string; tone: DocTone } {
  return isVerified
    ? { label: 'À jour', tone: 'ok' }
    : { label: 'En vérification', tone: 'neutral' };
}
