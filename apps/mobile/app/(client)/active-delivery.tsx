import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { DeliveryStatusStepper } from '@/components/delivery';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useSimulatedDriverMovement } from '@/hooks/useSimulatedDriverMovement';
import { openPhone } from '@/utils/linking';
import { shareLocationWhatsApp } from '@/utils/linking';

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const { activeDelivery, activeDriver, driverLocation } = useDeliveryStore();

  const delivery = activeDelivery;
  const driver = activeDriver;

  // Simulate driver movement
  const { currentPosition } = useSimulatedDriverMovement({
    from: driverLocation || delivery?.pickupLocation || { latitude: 12.3714, longitude: -1.5197 },
    to: delivery?.deliveryLocation || { latitude: 12.3500, longitude: -1.5500 },
    durationMs: 60000,
    enabled: !!delivery && delivery.status !== 'delivered',
  });

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
        center={delivery.pickupLocation}
        zoom={13}
        markers={[
          { id: 'pickup', coordinate: delivery.pickupLocation, icon: 'pickup' },
          { id: 'delivery', coordinate: delivery.deliveryLocation, icon: 'delivery' },
          { id: 'driver', coordinate: currentPosition, icon: 'driver' },
        ]}
        routeCoordinates={[delivery.pickupLocation, delivery.deliveryLocation]}
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
              onPress={() =>
                shareLocationWhatsApp(
                  delivery.recipientPhone,
                  delivery.reference,
                  currentPosition.latitude,
                  currentPosition.longitude
                )
              }
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
