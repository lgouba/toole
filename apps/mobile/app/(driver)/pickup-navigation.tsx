import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { CancelReasonDialog } from '@/components/CancelReasonDialog';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { openPhone, shareLocationWhatsApp, openNavigation } from '@/utils/linking';

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { activeDelivery, cancelActiveDelivery } = useDriverStore();
  const [showCancel, setShowCancel] = useState(false);

  if (!activeDelivery) return null;

  const handleCancelConfirm = async (reason: string, comment: string) => {
    const ok = await cancelActiveDelivery(reason, comment || undefined);
    setShowCancel(false);
    if (ok) router.replace('/(driver)');
  };

  return (
    <View style={styles.container}>
      <Map
        center={activeDelivery.pickupLocation}
        zoom={14}
        markers={[{ id: 'pickup', coordinate: activeDelivery.pickupLocation, icon: 'pickup' }]}
      />

      <SafeAreaView edges={['top']} style={styles.backButton}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Recuperation du colis</Text>
        <Text style={styles.address}>{activeDelivery.pickupAddress}</Text>
        {activeDelivery.pickupDetails && (
          <Text style={styles.details}>{activeDelivery.pickupDetails}</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              openNavigation(
                activeDelivery.pickupLocation.latitude,
                activeDelivery.pickupLocation.longitude,
                activeDelivery.pickupAddress,
              )
            }
          >
            <Ionicons name="navigate" size={22} color={colors.primary} />
            <Text style={styles.actionLabel}>Itinéraire</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openPhone(activeDelivery.recipientPhone)}
          >
            <Ionicons name="call" size={22} color={colors.primary} />
            <Text style={styles.actionLabel}>Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              shareLocationWhatsApp(
                activeDelivery.recipientPhone,
                activeDelivery.reference,
                activeDelivery.pickupLocation.latitude,
                activeDelivery.pickupLocation.longitude,
              )
            }
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Je suis arrive"
          onPress={() => router.replace('/(driver)/pickup-confirm')}
        />
        <View style={{ height: 8 }} />
        <Button
          title="Annuler la course"
          variant="outline"
          onPress={() => setShowCancel(true)}
        />
      </View>

      <CancelReasonDialog
        visible={showCancel}
        title="Annuler la course"
        subtitle="La course sera remise en file pour d'autres livreurs."
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancelConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  backButton: { position: 'absolute', top: 0, left: spacing.md },
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  address: {
    ...typography.body,
    color: colors.textPrimary,
  },
  details: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
});
