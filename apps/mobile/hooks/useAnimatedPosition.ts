import { useEffect, useRef, useState } from 'react';
import { LatLng } from '@/types';

/**
 * Anime smoothly la position d'un livreur entre chaque mise a jour Socket.
 *
 * En pratique le backend emet la position du livreur toutes les ~10 secondes
 * (heartbeat `pushLocation`). Si on affichait brutalement la nouvelle coordonnee,
 * le marqueur "sauterait" sur la carte. Ici on interpole lineairement entre
 * l'ancienne et la nouvelle position sur ~1.2s, ce qui donne un deplacement
 * visuellement fluide, tout en restant fidele a la vraie position GPS.
 *
 * Retourne { position } — la coordonnee interpolee a afficher a l'ecran.
 */
export function useAnimatedPosition(
  target: LatLng | null,
  fallback: LatLng | null,
  stepMs = 1200,
): { position: LatLng | null } {
  const [position, setPosition] = useState<LatLng | null>(target ?? fallback);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fromRef = useRef<LatLng | null>(null);
  const toRef = useRef<LatLng | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!target) {
      // Pas de cible connue -> on affiche le fallback (pickup) sans animer
      if (fallback) setPosition(fallback);
      return;
    }

    // Premiere cible connue : place instantane, pas d'anim
    if (!position) {
      setPosition(target);
      return;
    }

    // Si la cible n'a pas bouge (pas de difference notable), on ne refait rien
    const sameAsCurrent =
      Math.abs(position.latitude - target.latitude) < 1e-6 &&
      Math.abs(position.longitude - target.longitude) < 1e-6;
    if (sameAsCurrent) return;

    fromRef.current = position;
    toRef.current = target;
    startTimeRef.current = Date.now();

    if (rafRef.current) clearInterval(rafRef.current);
    rafRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - startTimeRef.current) / stepMs);
      const from = fromRef.current;
      const to = toRef.current;
      if (!from || !to) return;
      setPosition({
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
      });
      if (t >= 1 && rafRef.current) {
        clearInterval(rafRef.current);
        rafRef.current = null;
      }
    }, 50); // 20 fps suffit largement pour un tracking GPS visuel

    return () => {
      if (rafRef.current) {
        clearInterval(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.latitude, target?.longitude, stepMs]);

  return { position };
}
