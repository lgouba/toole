import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { OnlineToggle } from '@/components/driver';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useDriverStore } from '@/stores/driver.store';
import { useLocationStore } from '@/stores/location.store';
import { LatLng } from '@/types';

export default function DriverHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useDriverStore((s) => s.isOnline);
  const toggleOnline = useDriverStore((s) => s.toggleOnline);
  const currentLocation = useDriverStore((s) => s.currentLocation);
  const activeDelivery = useDriverStore((s) => s.activeDelivery);
  // Position GPS globale (recuperee au lancement de l'app, partagee avec le client)
  const userLocation = useLocationStore((s) => s.current);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);

  const firstName = user?.firstName || user?.fullName.split(' ')[0] || 'Livreur';
  const isActivated = !!user?.isActive;

  // Demande/rafraichit la position GPS au mount si pas encore connue
  useEffect(() => {
    if (!userLocation) {
      refreshLocation().catch(() => {});
    }
  }, [userLocation, refreshLocation]);

  // Priorite : currentLocation (heartbeat en ligne) > userLocation (GPS global)
  // > Ouagadougou (fallback ultime). Garantit qu'on n'affiche jamais Ouaga
  // pour un livreur situe ailleurs des qu'on a une position GPS.
  const myPosition: LatLng = currentLocation ?? userLocation ?? getCenter();

  // Markers a afficher :
  //  - toujours : position du livreur (avatar moto)
  //  - si course active : pickup + delivery
  const mapMarkers = useMemo(() => {
    const list: Array<{
      id: string;
      coordinate: LatLng;
      icon: 'driver' | 'pickup' | 'delivery';
    }> = [{ id: 'me', coordinate: myPosition, icon: 'driver' }];
    if (activeDelivery) {
      list.push({
        id: 'pickup',
        coordinate: {
          latitude: Number(activeDelivery.pickupLocation.latitude),
          longitude: Number(activeDelivery.pickupLocation.longitude),
        },
        icon: 'pickup',
      });
      list.push({
        id: 'delivery',
        coordinate: {
          latitude: Number(activeDelivery.deliveryLocation.latitude),
          longitude: Number(activeDelivery.deliveryLocation.longitude),
        },
        icon: 'delivery',
      });
    }
    return list;
  }, [myPosition, activeDelivery]);

  // Trajet : si course active, tracer pickup -> delivery
  const routeCoords: [LatLng, LatLng] | undefined = activeDelivery
    ? [
        activeDelivery.pickupLocation,
        activeDelivery.deliveryLocation,
      ]
    : undefined;

  return (
    <View style={styles.container}>
      <Map
        center={myPosition}
        zoom={14}
        interactive
        markers={mapMarkers}
        routeCoordinates={routeCoords}
        fitToContent={!!activeDelivery}
      />

      {/* Overlay d'informations en haut */}
      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>Bonjour, {firstName}</Text>
        </View>

        {!isActivated ? (
          <View style={styles.pendingCard}>
            <View style={styles.pendingIconWrap}>
              <Ionicons name="time-outline" size={24} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Compte en validation</Text>
              <Text style={styles.pendingText} numberOfLines={2}>
                Vous recevrez une notification dès que votre compte sera activé.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.onlineWrap}>
            <OnlineToggle isOnline={isOnline} onToggle={toggleOnline} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  greetingCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  greeting: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  onlineWrap: {
    // OnlineToggle a déjà son propre style
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {
    ...typography.bodyMedium,
    color: '#a66908',
    fontWeight: '700',
  },
  pendingText: {
    ...typography.caption,
    color: '#a66908',
    marginTop: 2,
  },
});
