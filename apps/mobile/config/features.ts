/**
 * Feature flags applicatifs (mobile).
 *
 * Permet d'activer/désactiver des pans de l'app sans supprimer le code, le
 * temps que les intégrations externes soient prêtes.
 */

/**
 * Paiement Mobile Money (Orange Money / Moov Money) côté client.
 *
 * FALSE pour le lancement Android : les API de paiement ne sont pas encore
 * intégrées. Seul « Espèces à la livraison » est proposé ; Orange/Moov sont
 * affichés grisés (« Bientôt »). Repasser à TRUE une fois les API branchées.
 */
export const MOBILE_MONEY_ENABLED = false;
