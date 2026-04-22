import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { getActiveDelivery } from '@/services/delivery.service';

/**
 * Garde de navigation : au lancement de l'app, au retour en foreground ou
 * apres login, verifie s'il y a une livraison active et ramene l'utilisateur
 * sur l'ecran approprie s'il s'est retrouve ailleurs par inadvertance.
 *
 * Regles :
 *  - Client avec livraison 'pending' -> /(client)/searching
 *  - Client avec livraison 'accepted' / 'picked_up' / 'delivering' -> /(client)/active-delivery
 *  - Client avec livraison 'delivered' -> /(client)/delivery-complete (pour noter)
 *  - Livreur avec delivery 'accepted' -> /(driver)/pickup-navigation
 *  - Livreur avec delivery 'picked_up' / 'delivering' -> /(driver)/delivery-navigation
 *
 * La garde n'interrompt JAMAIS une saisie normale — elle n'agit qu'au demarrage
 * ou au retour d'un state background. Elle laisse passer si l'utilisateur est
 * deja dans le bon sous-arbre de l'app.
 */
export function ActiveDeliveryGuard() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const lastCheckRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const runCheck = async () => {
    if (!isAuthenticated || !user) {
      console.log('[Guard] skipped: not authenticated');
      return;
    }
    if (Date.now() - lastCheckRef.current < 5000) {
      console.log('[Guard] throttled');
      return;
    }
    lastCheckRef.current = Date.now();

    try {
      const role = user.userType === 'driver' ? 'driver' : 'client';
      console.log('[Guard] checking for', role, user.fullName);
      const active = await getActiveDelivery(role);
      console.log(
        '[Guard] active delivery =',
        active ? `${active.id} (${active.status})` : 'none',
      );
      if (!active) return;

      // Met a jour les stores pour que les ecrans cibles trouvent leurs donnees
      if (role === 'client') {
        useDeliveryStore.getState().setActiveDelivery(active);
      } else {
        useDriverStore.setState({ activeDelivery: active });
      }

      const topSegment = segments[0] as string | undefined;
      const currentPath = '/' + segments.join('/');

      const targetPath = computeTargetPath(role, active.status);
      console.log('[Guard] target=', targetPath, 'current=', currentPath);
      if (!targetPath) return;

      if (currentPath === targetPath) {
        console.log('[Guard] already on target');
        return;
      }

      // Ecrans ou il ne faut PAS rediriger meme si le statut ne correspond pas
      // strictement (l'utilisateur est en train d'interagir avec un flow actif).
      const protectedFlows = [
        'new-delivery',
        'profile-edit',
        'settings',
        'kyc',
        'address-picker',
        // Ecrans de confirmation / validation cote livreur - il est dans l'etape
        // "je suis arrive / je prends la photo / je valide le code", meme si le
        // statut DB est encore "accepted" / "picked_up"
        'pickup-confirm',
        'delivery-confirm',
        'code-validation',
        // Ecran nouvelle demande : la course n'est pas encore accepted en DB,
        // mais l'utilisateur est en train de decider
        'new-request',
      ];
      if (protectedFlows.some((p) => currentPath.includes(p))) {
        console.log('[Guard] in protected flow, not redirecting');
        return;
      }

      if (topSegment === '(auth)') {
        console.log('[Guard] in auth flow, not redirecting');
        return;
      }

      console.log('[Guard] REDIRECTING to', targetPath);
      router.replace(targetPath as never);
    } catch (err) {
      console.warn('[Guard] error', err);
    }
  };

  // Check au demarrage + quand auth change
  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Check au retour en foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        runCheck();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function computeTargetPath(
  role: 'client' | 'driver',
  status: string,
): string | null {
  if (role === 'client') {
    switch (status) {
      case 'pending':
        return '/(client)/searching';
      case 'accepted':
      case 'picking_up':
      case 'picked_up':
      case 'delivering':
        return '/(client)/active-delivery';
      case 'delivered':
        return '/(client)/delivery-complete';
      default:
        return null;
    }
  } else {
    switch (status) {
      case 'accepted':
      case 'picking_up':
        return '/(driver)/pickup-navigation';
      case 'picked_up':
      case 'delivering':
        return '/(driver)/delivery-navigation';
      default:
        return null;
    }
  }
}
