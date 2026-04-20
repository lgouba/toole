import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { DeliveryStatusStepper } from '@/components/delivery';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAnimatedPosition } from '@/hooks/useAnimatedPosition';
import { openPhone } from '@/utils/linking';
import { shareLocationWhatsApp } from '@/utils/linking';
import { LatLng } from '@/types';

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const { activeDelivery, activeDriver, driverLocation } = useDeliveryStore();

  const delivery = activeDelivery;
  const driver = activeDriver;

  // Position reelle du livreur, interpolee pour une animation fluide
  // entre chaque heartbeat (~10s). Tant qu'on n'a pas encore recu la
  // premiere position, on se base sur pickup comme fallback visuel.
  const fallback: LatLng | null = delivery?.pickupLocation ?? null;
  const { position: driverPos } = useAnimatedPosition(
    driverLocation,
    fallback,
  );

  // Adapte la route affichee selon la phase de la course :
  //  - livreur vers pickup (avant ramassage) : driver -> pickup
  //  - livreur vers delivery (apres ramassage) : driver -> delivery
  //  - sans position livreur : pickup -> delivery (fallback)
  const routeCoords = useMemo<[LatLng, LatLng] | undefined>(() => {
    if (!delivery) return undefined;
    const pickedUp =
      delivery.status === 'picked_up' || delivery.status === 'delivering';
    if (driverPos) {
      return pickedUp
        ? [driverPos, delivery.deliveryLocation]
        : [driverPos, delivery.pickupLocation];
    }
    return [delivery.pickupLocation, delivery.deliveryLocation];
  }, [driverPos, delivery?.status, delivery?.pickupLocation, delivery?.deliveryLocation]);

  // Marqueurs : toujours afficher pickup + delivery + (livreur si connu)
  const mapMarkers = useMemo(() => {
    if (!delivery) return [];
    const list: Array<{
      id: string;
      coordinate: LatLng;
      icon: 'pickup' | 'delivery' | 'driver';
    }> = [
      { id: 'pickup', coordinate: delivery.pickupLocation, icon: 'pickup' },
      {
        id: 'delivery',
        coordinate: delivery.deliveryLocation,
        icon: 'delivery',
      },
    ];
    if (driverPos) {
      list.push({ id: 'driver', coordinate: driverPos, icon: 'driver' });
    }
    return list;
  }, [driverPos, delivery?.pickupLocation, delivery?.deliveryLocation]);

  // Centre la carte sur le livreur tant qu'il bouge, sinon sur pickup
  const mapCenter = driverPos ?? delivery?.pickupLocation ?? {
    latitude: 12.3714,
    longitude: -1.5197,
  };

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.noDelivery}>Aucune livraison active</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Map
        center={mapCenter}
        zoom={14}
        markers={mapMarkers}
        routeCoordinates={routeCoords}
      />

      {/* Back button */}
      <SafeAreaView edges={['top']} style={styles.backButton}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backCircle}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
        >

        {/* Driver info */}
        {driver && (
          <View style={styles.driverRow}>
            <Avatar name={driver.fullName} size="md" />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.fullName}</Text>
              <Text style={styles.driverMeta}>
                {driver.ratingAvg.toFixed(1)} ★ · {driver.driverProfile.totalDeliveries} courses
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => openPhone(driver.phone)}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const loc = driverPos ?? delivery.deliveryLocation;
                shareLocationWhatsApp(
                  delivery.recipientPhone,
                  delivery.reference,
                  loc.latitude,
                  loc.longitude,
                );
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </TouchableOpacity>
          </View>
        )}

        {/* Status stepper */}
        <DeliveryStatusStepper status={delivery.status} />

        {/* Validation code */}
        {delivery.status !== 'delivered' && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Code de validation</Text>
            <Text style={styles.codeValue}>{delivery.validationCode}</Text>
            <Text style={styles.codeHint}>
              Communiquez ce code au destinataire
            </Text>
          </View>
        )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  noDelivery: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.sm,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  driverInfo: { flex: 1 },
  driverName: { ...typography.bodyMedium, color: colors.textPrimary },
  driverMeta: { ...typography.caption, color: colors.textSecondary },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  codeLabel: {
    ...typography.captionMedium,
    color: colors.primaryDark,
  },
  codeValue: {
    ...typography.h1,
    color: colors.primaryDark,
    letterSpacing: 8,
    marginVertical: spacing.xs,
  },
  codeHint: {
    ...typography.caption,
    color: colors.primaryDark,
  },
});
