import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Reassurance } from '@/components/home/Reassurance';
import { recap as R, home as H } from '@/theme/recapTokens';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import { getNearbyDriversForMap, MapDriver } from '@/services/driver.service';

const REFRESH_MS = 20_000;
const ACTIVE_STATUSES = ['accepted', 'picking_up', 'picked_up', 'delivering'];

// Livreurs fictifs (états mélangés) autour de la position — fallback quand le
// flux réel /drivers/map ne renvoie encore rien (avant déploiement serveur ou
// zone sans livreur). Reproduit la maquette (motos vertes + grises).
function mockCouriers(center: { latitude: number; longitude: number }): MapDriver[] {
  const offs = [
    { dx: 0.012, dy: 0.008, online: true },
    { dx: -0.015, dy: 0.004, online: true },
    { dx: 0.006, dy: -0.013, online: false },
    { dx: -0.009, dy: -0.01, online: true },
    { dx: 0.018, dy: -0.002, online: false },
    { dx: -0.004, dy: 0.015, online: true },
    { dx: 0.01, dy: 0.016, online: false },
  ];
  return offs.map((o, i) => ({
    id: `mock-${i}`,
    location: { latitude: center.latitude + o.dy, longitude: center.longitude + o.dx },
    online: o.online,
  }));
}

/**
 * Accueil client = LANCEUR + surface d'état. Aucune saisie d'adresse ici : la
 * carte est décorative et montre les livreurs en ligne (moto verte). Le CTA
 * ouvre l'étape 1 du flux ; il ne réutilise aucun composant de saisie.
 */
export default function ClientHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeDelivery = useDeliveryStore((s) => s.activeDelivery);
  const userLocation = useLocationStore((s) => s.current);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);

  const [mapDrivers, setMapDrivers] = useState<MapDriver[]>([]);

  const firstName = user?.fullName?.split(' ')[0] || 'Client';
  const hasActiveDelivery =
    !!activeDelivery && ACTIVE_STATUSES.includes(activeDelivery.status);

  // Rafraîchit les livreurs (en ligne + hors ligne) proches au focus + toutes
  // les 20s ; on coupe le polling quand l'écran perd le focus (perf / batterie).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async (pos: { latitude: number; longitude: number }) => {
        const drivers = await getNearbyDriversForMap(pos);
        if (cancelled) return;
        // Fallback mock (états mélangés) si aucun livreur réel encore.
        setMapDrivers(drivers.length > 0 ? drivers : mockCouriers(pos));
      };
      (async () => {
        const pos = userLocation ?? (await refreshLocation());
        load(pos ?? getCenter());
      })();
      intervalRef.current = setInterval(() => {
        load(useLocationStore.getState().current ?? getCenter());
      }, REFRESH_MS);
      return () => {
        cancelled = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Marqueurs moto : vert (en ligne) / gris (hors ligne).
  const markers = useMemo(
    () =>
      mapDrivers.map((d) => ({
        id: d.id,
        coordinate: d.location,
        icon: 'courier' as const,
        online: d.online,
      })),
    [mapDrivers],
  );

  return (
    <View style={styles.container}>
      <Map
        center={getCenter()}
        zoom={13}
        markers={markers}
        theme="soft"
        interactive
        coverage={{ center: getCenter(), radiusKm: 6 }}
      />

      {/* Salutation flottante */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>Bienvenue, {firstName} 👋</Text>
          <Text style={styles.greetingSub}>
            {hasActiveDelivery
              ? 'Une livraison est en cours.'
              : 'Envoie ton premier colis à Ouaga.'}
          </Text>
        </View>
      </SafeAreaView>

      {/* Panneau onboarding / lanceur */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.panel}>
          <Button
            title={hasActiveDelivery ? 'Suivre ma livraison' : 'Envoyer un colis'}
            onPress={() =>
              router.push(
                hasActiveDelivery ? '/(client)/active-delivery' : '/(client)/new-delivery',
              )
            }
            icon={
              <Ionicons
                name={hasActiveDelivery ? 'navigate' : 'cube-outline'}
                size={20}
                color={H.surface}
              />
            }
          />

          {!hasActiveDelivery && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>COMMENT ÇA MARCHE</Text>
              <HowItWorks />
              <View style={styles.divider} />
              <Reassurance />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.canvas },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  greetingCard: {
    marginHorizontal: R.space.lg,
    marginTop: R.space.sm,
    backgroundColor: H.surface,
    borderRadius: H.radius.card,
    borderWidth: 1,
    borderColor: H.border,
    paddingVertical: R.space.lg,
    paddingHorizontal: R.space.gut,
    shadowColor: '#503C0A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  greeting: { fontFamily: R.font.display, fontSize: 19, color: H.textPrim },
  greetingSub: { fontFamily: R.font.body, fontSize: 13, color: H.textSec, marginTop: 2 },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  panel: {
    marginHorizontal: R.space.md,
    marginBottom: R.space.sm,
    backgroundColor: H.surface,
    borderRadius: H.radius.sheet,
    borderWidth: 1,
    borderColor: H.border,
    padding: R.space.gut,
    gap: R.space.md,
    shadowColor: '#503C0A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  divider: { height: 1, backgroundColor: H.border },
  sectionLabel: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: H.textMuted,
  },
});
