import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import * as driverService from './driver.service';

/**
 * Tâche de localisation en arrière-plan du livreur.
 *
 * Enregistrée au chargement de l'app (importée depuis _layout) pour qu'elle
 * existe AUSSI dans le contexte "headless" quand l'OS réveille l'app en
 * arrière-plan. Chaque point GPS est poussé au serveur en HTTP ; le serveur
 * le forwarde au client via socket (`delivery:driver_location`) → suivi temps
 * réel même app fermée / écran éteint.
 *
 * On ne dépend PAS du socket ici (souvent mort en arrière-plan) : le HTTP est
 * le canal fiable.
 */
export const BG_LOCATION_TASK = 'toole-driver-location';

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[bg-location] task error:', error.message);
    return;
  }
  const locations = (data as { locations?: LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;

  // On ne pousse que le point le plus récent du lot.
  const last = locations[locations.length - 1];
  const loc = {
    latitude: last.coords.latitude,
    longitude: last.coords.longitude,
  };

  try {
    await driverService.updateLocation(loc);
  } catch {
    // Réseau BF instable : on ignore, le point suivant réessaiera.
  }

  // Met à jour la carte locale du livreur (effectif quand l'app est au premier
  // plan ; sans effet visible en arrière-plan, mais inoffensif).
  try {
    const { useDriverStore } = await import('@/stores/driver.store');
    useDriverStore.setState({ currentLocation: loc });
  } catch {
    // ignore
  }
});
