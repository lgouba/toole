import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { GradientButton } from '@/components/aurora/AuroraBits';
import { AU, AF, glassShadow } from '@/theme/aurora';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import { getNearbyDriversForMap, MapDriver } from '@/services/driver.service';

const REFRESH_MS = 20_000;
const ACTIVE_STATUSES = ['accepted', 'picking_up', 'picked_up', 'delivering'];
const MAP_ZOOM = 13;
// Décalage (en degrés de latitude) du CENTRE de la carte vers le sud, pour que le
// halo "zone desservie" (dessiné à la vraie position) REMONTE dans la bande visible
// entre la carte de salutation (haut) et la feuille lanceur (bas), au lieu d'être
// masqué par celle-ci. Calibré pour le zoom 13 (~18 m/px → ~0.018° ≈ 100 px de lift).
const MAP_LIFT_LAT = 0.018;

const STEPS: { title: string }[] = [
  { title: 'Décris ton colis' },
  { title: 'Indique le trajet' },
  { title: "Un livreur s'en charge" },
];

const REASSURANCE: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'flash-outline', label: 'Rapide' },
  { icon: 'cash-outline', label: 'Paiement à la livraison' },
  { icon: 'navigate-outline', label: 'Suivi temps réel' },
];

// Livreurs fictifs (états mélangés) autour de la position — fallback DEV quand le
// flux réel /drivers/map ne renvoie rien. Jamais en prod (ne pas induire en erreur).
function mockCouriers(center: { latitude: number; longitude: number }): MapDriver[] {
  // Étalement resserré au nord du point (dy positif = nord) pour que les motos
  // décoratives restent dans la bande visible AU-DESSUS de la feuille lanceur,
  // cohérent avec le halo remonté (MAP_LIFT_LAT).
  const offs = [
    { dx: 0.012, dy: 0.012, online: true },
    { dx: -0.015, dy: 0.009, online: true },
    { dx: 0.006, dy: -0.004, online: false },
    { dx: -0.009, dy: 0.002, online: true },
    { dx: 0.018, dy: 0.006, online: false },
    { dx: -0.004, dy: 0.016, online: true },
    { dx: 0.01, dy: 0.018, online: false },
  ];
  return offs.map((o, i) => ({
    id: `mock-${i}`,
    location: { latitude: center.latitude + o.dy, longitude: center.longitude + o.dx },
    online: o.online,
  }));
}

/**
 * Accueil client (direction « Aurora », variante « carte héros + feuille basse »).
 * = LANCEUR + surface d'état. Aucune saisie d'adresse : la carte est décorative
 * (livreurs en ligne + zone desservie). Le CTA ouvre l'étape 1 du flux. Logique
 * métier identique à l'ancienne version — seul l'habillage change.
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

  // Vraie position (halo + marqueurs) et centre de carte abaissé (halo remonté).
  const anchor = getCenter();
  const mapCenter = useMemo(
    () => ({ latitude: anchor.latitude - MAP_LIFT_LAT, longitude: anchor.longitude }),
    [anchor.latitude, anchor.longitude],
  );

  // Rafraîchit les livreurs proches au focus + toutes les 20s ; coupe le polling
  // quand l'écran perd le focus (perf / batterie).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async (pos: { latitude: number; longitude: number }) => {
        const drivers = await getNearbyDriversForMap(pos);
        if (cancelled) return;
        if (drivers.length > 0) setMapDrivers(drivers);
        else setMapDrivers(__DEV__ ? mockCouriers(pos) : []);
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

  const goPrimary = () =>
    router.push(hasActiveDelivery ? '/(client)/active-delivery' : '/(client)/new-delivery');

  return (
    <View style={styles.container}>
      <Map
        center={mapCenter}
        zoom={MAP_ZOOM}
        markers={markers}
        theme="soft"
        interactive
        coverage={{ center: anchor, radiusKm: 6 }}
      />

      {/* Carte de salutation flottante (haut) */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.greetCard}>
          <Text style={styles.greeting}>Bienvenue, {firstName} 👋</Text>
          <Text style={styles.greetingSub}>
            {hasActiveDelivery
              ? 'Une livraison est en cours.'
              : 'Envoie ton premier colis à Ouaga.'}
          </Text>
        </View>
      </SafeAreaView>

      {/* Feuille lanceur (bas) */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.sheet}>
          <GradientButton
            label={hasActiveDelivery ? 'Suivre ma livraison' : 'Envoyer un colis'}
            icon={hasActiveDelivery ? 'navigate' : 'cube-outline'}
            onPress={goPrimary}
          />

          {!hasActiveDelivery && (
            <>
              <View style={styles.divider} />
              <Text style={styles.eyebrow}>COMMENT ÇA MARCHE</Text>
              <View style={styles.steps}>
                {STEPS.map((s, i) => (
                  <View key={s.title} style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepTitle} numberOfLines={2}>
                      {s.title}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.reassurance}>
                {REASSURANCE.map((r) => (
                  <View key={r.label} style={styles.reassItem}>
                    <Ionicons name={r.icon} size={15} color={AU.kola} />
                    <Text style={styles.reassLabel} numberOfLines={2}>
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AU.ground },

  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  greetCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: AU.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AU.hairline,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...glassShadow,
  },
  greeting: { fontFamily: AF.dispB, fontSize: 19, color: AU.ink, letterSpacing: -0.3 },
  greetingSub: { fontFamily: AF.med, fontSize: 12.5, color: AU.muted, marginTop: 2 },

  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: AU.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: AU.hairline,
    padding: 16,
    gap: 13,
    ...glassShadow,
  },
  divider: { height: 1, backgroundColor: AU.hairline },
  eyebrow: {
    fontFamily: AF.mono,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: AU.faint,
  },

  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F2EC',
    borderWidth: 1,
    borderColor: '#D4E6DA',
  },
  stepNumText: { fontFamily: AF.dispB, fontSize: 12, color: AU.kola },
  stepTitle: { fontFamily: AF.bold, fontSize: 11, color: AU.ink, textAlign: 'center', lineHeight: 14 },

  reassurance: { flexDirection: 'row', gap: 6 },
  reassItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F2F5F7',
    borderWidth: 1,
    borderColor: AU.hairline,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  reassLabel: { fontFamily: AF.med, fontSize: 9.5, color: AU.muted, textAlign: 'center' },
});
