import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Cet ecran est conserve uniquement pour la retro-compat des handlers push
 * notification qui peuvent encore faire `router.push('/(driver)/new-request')`.
 *
 * Le vrai affichage de la demande de course est maintenant gere par le
 * composant <NewRequestModal /> monte dans (driver)/_layout.tsx. Cette modal
 * s'affiche automatiquement des que `currentRequest` est defini dans le store.
 *
 * On redirige donc vers /(driver) — la modal sera deja visible par-dessus.
 */
export default function NewRequestRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(driver)');
  }, [router]);
  return null;
}
