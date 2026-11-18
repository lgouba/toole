/**
 * Décision PURE (sans import RN) : faut-il recharger l'app suite à un changement
 * de couleurs admin, et est-ce le bon moment ? Isolé ici pour être testable sans
 * device. Le wiring (AppState, stores, reload effectif) est dans ThemeGate +
 * reloadApp.ts.
 */

export interface ColorPair {
  primary: string;
  secondary: string;
}

/**
 * `baseline` = couleurs de référence fixées APRÈS hydratation du store persistant.
 * Tant qu'elle vaut `null` (app pas encore stabilisée), on ne recharge jamais :
 * c'est ce qui évite la boucle au démarrage (transition défaut → couleur persistée).
 * Ensuite, tout écart primary/secondary déclenche un reload.
 */
export function shouldReloadForColors(baseline: ColorPair | null, next: ColorPair): boolean {
  if (!baseline) return false;
  return baseline.primary !== next.primary || baseline.secondary !== next.secondary;
}

/**
 * On ne recharge que si l'app est au premier plan ET qu'aucune course n'est active
 * (côté client ou livreur), pour ne pas interrompre une navigation / un suivi.
 */
export function isSafeToReload(ctx: { appActive: boolean; hasActiveDelivery: boolean }): boolean {
  return ctx.appActive && !ctx.hasActiveDelivery;
}
