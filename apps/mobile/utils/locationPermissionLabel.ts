/**
 * Traduit l'état des permissions de localisation en libellé + ton pour l'UI
 * Paramètres (section livreur). Isolé ici pour être testable sans expo-location.
 *
 * Enjeu métier : un livreur avec la localisation « seulement pendant l'usage »
 * (foreground only) voit sa position se figer dès que l'app passe en arrière-plan
 * → il devient invisible pour le matching (bug GPS périmé déjà vécu). On veut
 * donc distinguer clairement « en continu » (OK) de « à l'usage » (à corriger).
 */
export type PermissionTone = 'ok' | 'warn' | 'bad';

export interface LocationPermissionState {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

export interface LocationPermissionDescription {
  label: string;
  tone: PermissionTone;
  /** true quand le livreur risque de devenir invisible (position figée en fond). */
  needsAttention: boolean;
}

export function describeLocationPermission(
  state: LocationPermissionState,
): LocationPermissionDescription {
  if (state.backgroundGranted) {
    // backgroundGranted implique foreground accordé côté OS.
    return { label: 'Activée en continu', tone: 'ok', needsAttention: false };
  }
  if (state.foregroundGranted) {
    return {
      label: 'Seulement pendant l’usage',
      tone: 'warn',
      needsAttention: true,
    };
  }
  return { label: 'Désactivée', tone: 'bad', needsAttention: true };
}
