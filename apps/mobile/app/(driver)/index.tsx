import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { MapScrim } from '@/components/driver/cockpit/MapScrim';
import { IgnitionDial } from '@/components/driver/cockpit/IgnitionDial';
import { StatusText } from '@/components/driver/cockpit/StatusText';
import { DriverKpis } from '@/components/driver/cockpit/DriverKpis';
import { recap as R, driverHome as D } from '@/theme/recapTokens';
import { useAuthStore } from '@/stores/auth.store';
import { useDriverStore } from '@/stores/driver.store';
import { useLocationStore } from '@/stores/location.store';
import { getMyDriverStats, DriverStats } from '@/services/driver.service';
import { LatLng } from '@/types';

function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')}`;
}

export default function DriverHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useDriverStore((s) => s.isOnline);
  const toggleOnline = useDriverStore((s) => s.toggleOnline);
  const currentLocation = useDriverStore((s) => s.currentLocation);
  const userLocation = useLocationStore((s) => s.current);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);

  const [stats, setStats] = useState<DriverStats | null>(null);
  const [onlineSince, setOnlineSince] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Livreur';
  const isActivated = !!user?.isActive;
  const myPosition: LatLng = currentLocation ?? userLocation ?? getCenter();

  useEffect(() => {
    if (!userLocation) refreshLocation().catch(() => {});
  }, [userLocation, refreshLocation]);

  // Durée "en ligne" (timer local — pas de champ backend).
  useEffect(() => {
    if (isOnline && !onlineSince) setOnlineSince(Date.now());
    if (!isOnline) setOnlineSince(null);
  }, [isOnline, onlineSince]);
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [isOnline]);

  // Stats du jour au focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMyDriverStats().then((s) => { if (!cancelled && s) setStats(s); }).catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

  const handleToggle = async () => {
    if (!isOnline) {
      const pos = userLocation ?? (await refreshLocation());
      if (!pos) {
        Alert.alert(
          'Localisation requise',
          'Active la localisation pour passer en ligne et recevoir des courses.',
        );
        return;
      }
    }
    toggleOnline().catch(() => {});
  };

  const onlineLabel = isOnline && onlineSince ? formatDuration(Date.now() - onlineSince) : '—';

  return (
    <View style={styles.container}>
      {/* Carte interactive : boutons +/- (zoom sur les rues) + pan. Le voile est
          pointerEvents="none" et l'overlay cockpit box-none → la carte reçoit les
          taps là où il n'y a pas de contrôle (cadran/gains restent intacts). */}
      <Map center={myPosition} zoom={15} interactive theme="soft" />
      <MapScrim />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        {/* Salutation (sans avatar) */}
        <Text style={styles.greeting}>
          Bonjour, {firstName} · <Text style={styles.greetingBrand}>Toolé Driver</Text>
        </Text>

        {/* Cadran cockpit OU état "compte en validation" */}
        <View style={styles.center} pointerEvents="box-none">
          {isActivated ? (
            <>
              <IgnitionDial online={isOnline} onToggle={handleToggle} />
              <StatusText online={isOnline} />
            </>
          ) : (
            <View style={styles.pending}>
              <MaterialIcons name="hourglass-top" size={28} color="#C2410C" />
              <Text style={styles.pendingTitle}>Compte en validation</Text>
              <Text style={styles.pendingSub}>
                Tu pourras passer en ligne dès que ton compte sera activé.
              </Text>
            </View>
          )}
        </View>

        {/* Gains + KPIs */}
        <View style={styles.bottom}>
          <DriverKpis
            revenueToday={stats?.today.revenue}
            courses={stats?.today.deliveredCount}
            onlineLabel={onlineLabel}
            rating={stats && stats.ratingCount > 0 ? stats.ratingAvg : null}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.canvas },
  overlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: R.space.gut },
  greeting: {
    fontFamily: R.font.body,
    fontSize: 14,
    color: D.textSec,
    textAlign: 'center',
    marginTop: R.space.sm,
  },
  greetingBrand: { fontFamily: R.font.bodyBold, color: D.green },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingBottom: R.space.sm },
  pending: {
    alignItems: 'center',
    gap: R.space.sm,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: '#F0D9B8',
    borderRadius: D.radius.card,
    padding: R.space.xl,
    marginHorizontal: R.space.md,
  },
  pendingTitle: { fontFamily: R.font.display, fontSize: 17, color: D.textPrim },
  pendingSub: { fontFamily: R.font.body, fontSize: 13, color: D.textSec, textAlign: 'center' },
});
