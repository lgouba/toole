import React, { useCallback, useMemo, useRef } from 'react';
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

const REFRESH_MS = 20_000;
const ACTIVE_STATUSES = ['accepted', 'picking_up', 'picked_up', 'delivering'];

/**
 * Accueil client = LANCEUR + surface d'état. Aucune saisie d'adresse ici : la
 * carte est décorative et montre les livreurs en ligne (moto verte). Le CTA
 * ouvre l'étape 1 du flux ; il ne réutilise aucun composant de saisie.
 */
export default function ClientHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { nearbyDrivers, fetchNearbyDrivers, activeDelivery } = useDeliveryStore();
  const userLocation = useLocationStore((s) => s.current);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);

  const firstName = user?.fullName?.split(' ')[0] || 'Client';
  const hasActiveDelivery =
    !!activeDelivery && ACTIVE_STATUSES.includes(activeDelivery.status);

  // Rafraîchit les livreurs proches au focus + toutes les 20s ; on coupe le
  // polling quand l'écran perd le focus (perf / batterie).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const pos = userLocation ?? (await refreshLocation());
        if (!cancelled) fetchNearbyDrivers(pos ?? getCenter());
      })();
      intervalRef.current = setInterval(() => {
        fetchNearbyDrivers(useLocationStore.getState().current ?? getCenter());
      }, REFRESH_MS);
      return () => {
        cancelled = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Marqueurs moto (livreurs en ligne) — données réelles `nearbyDrivers`.
  const markers = useMemo(
    () =>
      nearbyDrivers
        .filter((d) => d.driverProfile?.currentLocation)
        .map((d) => ({
          id: d.id,
          coordinate: d.driverProfile.currentLocation!,
          icon: 'courier' as const,
          online: true,
        })),
    [nearbyDrivers],
  );

  return (
    <View style={styles.container}>
      <Map center={getCenter()} zoom={13} markers={markers} theme="soft" interactive />

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
