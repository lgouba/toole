import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { CancelReasonDialog } from '@/components/CancelReasonDialog';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { useSettingsStore } from '@/stores/settings.store';
import { openPhone, shareLocationWhatsApp, openNavigation } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { formatEta, formatDistance } from '@/utils/format';

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { activeDelivery, cancelActiveDelivery } = useDriverStore();
  const cooldownSec = useSettingsStore(
    (s) => s.settings.operations.driverCancelCooldownSeconds,
  );
  const [showCancel, setShowCancel] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Au mount + toutes les 10s, on verifie que la livraison existe encore
  // cote backend. Si elle a ete annulee/supprimee/expiree, on degage le
  // livreur de cet ecran (sinon il reste bloque sur une course fantome).
  useEffect(() => {
    if (!activeDelivery?.id) return;
    let cancelled = false;
    const check = async () => {
      const fresh = await getDeliveryById(activeDelivery.id);
      if (cancelled) return;
      if (!fresh) {
        // 404 -> livraison disparue
        useDriverStore.setState({ activeDelivery: null, currentRequest: null });
        router.replace('/(driver)');
        return;
      }
      const stale = ['cancelled', 'expired', 'pending'].includes(fresh.status);
      if (stale) {
        useDriverStore.setState({ activeDelivery: null, currentRequest: null });
        router.replace('/(driver)');
      } else {
        // Synchronise avec le backend (au cas ou une autre etape a avance)
        useDriverStore.setState({ activeDelivery: fresh });
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeDelivery?.id, router]);

  // Calcule et decremente le cooldown d'annulation base sur `acceptedAt`
  useEffect(() => {
    if (!activeDelivery?.acceptedAt) {
      setCooldownRemaining(0);
      return;
    }
    const update = () => {
      const acceptedAt = new Date(activeDelivery.acceptedAt!).getTime();
      const elapsed = (Date.now() - acceptedAt) / 1000;
      const left = Math.max(0, Math.ceil(cooldownSec - elapsed));
      setCooldownRemaining(left);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeDelivery?.acceptedAt, cooldownSec]);

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
        <Text style={styles.title}>Récupération du colis</Text>
        <Text style={styles.address}>{activeDelivery.pickupAddress}</Text>
        {activeDelivery.pickupDetails && (
          <Text style={styles.details}>{activeDelivery.pickupDetails}</Text>
        )}

        {activeDelivery.eta && (
          <View style={styles.etaPill}>
            <Ionicons name="time-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.etaPillText}>
              ~{formatEta(activeDelivery.eta.durationSeconds)} ·{' '}
              {formatDistance(activeDelivery.eta.distanceMeters / 1000)}
            </Text>
          </View>
        )}

        {activeDelivery.senderContactName && (
          <View style={styles.senderBanner}>
            <Ionicons name="person" size={18} color={colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.senderBannerLabel}>Expéditeur sur place</Text>
              <Text style={styles.senderBannerValue}>
                {activeDelivery.senderContactName}
              </Text>
            </View>
          </View>
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
            onPress={() =>
              openPhone(
                activeDelivery.senderContactPhone ||
                  activeDelivery.recipientPhone,
              )
            }
          >
            <Ionicons name="call" size={22} color={colors.primary} />
            <Text style={styles.actionLabel}>Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              shareLocationWhatsApp(
                activeDelivery.senderContactPhone ||
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
          title={
            cooldownRemaining > 0
              ? `Annuler la course (${cooldownRemaining}s)`
              : 'Delai d\'annulation écoulé'
          }
          variant="outline"
          onPress={() => setShowCancel(true)}
          disabled={cooldownRemaining === 0}
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
  senderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    marginTop: spacing.sm,
  },
  senderBannerLabel: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  senderBannerValue: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    marginTop: spacing.sm,
  },
  etaPillText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
