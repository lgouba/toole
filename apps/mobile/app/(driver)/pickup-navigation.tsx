import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { CancelReasonDialog } from '@/components/CancelReasonDialog';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useLocationStore } from '@/stores/location.store';
import { openPhone, shareLocationWhatsApp, openNavigation } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { formatEta, formatDistance } from '@/utils/format';
import { LatLng } from '@/types';

const SHEET_INSET = Dimensions.get('window').height * 0.5;

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { activeDelivery, cancelActiveDelivery } = useDriverStore();
  const driverPos = useLocationStore((s) => s.current);
  const cooldownSec = useSettingsStore(
    (s) => s.settings.operations.driverCancelCooldownSeconds,
  );
  const [showCancel, setShowCancel] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Au mount + toutes les 10s, on vérifie que la livraison existe encore
  // côté backend. Si elle a été annulée/supprimée/expirée, on dégage le
  // livreur de cet écran (sinon il reste bloque sur une course fantome).
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
        // Synchronise avec le backend (au cas ou une autre étape a avance)
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

  const handleCancelConfirm = async (reason: string, comment: string) => {
    const ok = await cancelActiveDelivery(reason, comment || undefined);
    setShowCancel(false);
    if (ok) router.replace('/(driver)');
  };

  // Marqueurs : point de récup (cible) + position du livreur (avatar) si connue.
  const markers = useMemo(() => {
    if (!activeDelivery) return [];
    const list: any[] = [
      { id: 'pickup', coordinate: activeDelivery.pickupLocation, icon: 'pickup' },
    ];
    if (driverPos) {
      list.push({ id: 'driver', coordinate: driverPos, icon: 'driver' });
    }
    return list;
  }, [activeDelivery?.pickupLocation, driverPos]);

  const route = useMemo<[LatLng, LatLng] | undefined>(
    () =>
      activeDelivery && driverPos
        ? [driverPos, activeDelivery.pickupLocation]
        : undefined,
    [driverPos, activeDelivery?.pickupLocation],
  );

  if (!activeDelivery) return null;

  return (
    <View style={styles.container}>
      <Map
        center={driverPos ?? activeDelivery.pickupLocation}
        zoom={14}
        markers={markers}
        routeCoordinates={route}
        fitToContent
        contentInsetTop={120}
        contentInsetBottom={SHEET_INSET}
      />

      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.statusPill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>Vers la récupération</Text>
        </View>
        <View style={{ width: 40 }} />
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
              : 'Délai d\'annulation écoulé'
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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  pillText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
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
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flexShrink: 1,
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
