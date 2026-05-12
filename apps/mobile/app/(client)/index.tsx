import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';

export default function ClientHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { nearbyDrivers, fetchNearbyDrivers } = useDeliveryStore();
  const userLocation = useLocationStore((s) => s.current);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);

  useEffect(() => {
    // Récupère la position GPS au montage si pas déjà faite, puis cherche
    // les livreurs proches autour de la position reelle de l'utilisateur.
    (async () => {
      const pos = userLocation ?? (await refreshLocation());
      fetchNearbyDrivers(pos ?? getCenter());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = user?.fullName.split(' ')[0] || 'Client';

  const markers = useMemo(
    () =>
      nearbyDrivers
        .filter((d) => d.driverProfile.currentLocation)
        .map((d) => ({
          id: d.id,
          coordinate: d.driverProfile.currentLocation!,
          icon: 'driver' as const,
          label: d.fullName,
        })),
    [nearbyDrivers]
  );

  return (
    <View style={styles.container}>
      <Map center={getCenter()} zoom={13} markers={markers} />

      {/* Top greeting */}
      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
          <Text style={styles.greetingSub}>Ou envoyez-vous aujourd'hui ?</Text>
        </View>
      </SafeAreaView>

      {/* Bottom CTA */}
      <View style={styles.bottomCard}>
        <Button
          title="Envoyer un colis"
          onPress={() => router.push('/(client)/new-delivery')}
          icon={<Ionicons name="cube-outline" size={20} color={colors.white} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  greetingCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  greeting: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  greetingSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bottomCard: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
});
