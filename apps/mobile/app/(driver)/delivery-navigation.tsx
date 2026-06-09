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
import { useLocationStore } from '@/stores/location.store';
import { openPhone, shareLocationWhatsApp, openNavigation } from '@/utils/linking';
import { getDeliveryById, getDeliveryRoute } from '@/services/delivery.service';
import { formatEta, formatDistance } from '@/utils/format';
import { LatLng } from '@/types';

const SHEET_INSET = Dimensions.get('window').height * 0.5;

export default function DeliveryNavigationScreen() {
  const router = useRouter();
  const { activeDelivery, cancelActiveDelivery } = useDriverStore();
  const driverPos = useLocationStore((s) => s.current);
  const [showCancel, setShowCancel] = useState(false);
  // Itinéraire routier réel (livreur → livraison), calculé serveur via OSRM.
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);

  // Verifie au mount et toutes les 10s que la livraison existe toujours
  // côté backend. Si elle a été supprimée/annulée/expirée, on dégage.
  useEffect(() => {
    if (!activeDelivery?.id) return;
    let cancelled = false;
    const check = async () => {
      const fresh = await getDeliveryById(activeDelivery.id);
      if (cancelled) return;
      if (!fresh) {
        useDriverStore.setState({ activeDelivery: null, currentRequest: null });
        router.replace('/(driver)');
        return;
      }
      if (['cancelled', 'expired', 'delivered'].includes(fresh.status)) {
        useDriverStore.setState({ activeDelivery: null, currentRequest: null });
        router.replace('/(driver)');
      } else {
        useDriverStore.setState({ activeDelivery: fresh });
        // Itinéraire routier réel (suit les rues) vers la livraison.
        const r = await getDeliveryRoute(activeDelivery.id);
        if (!cancelled && r) setRoutePath(r.path);
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeDelivery?.id, router]);

  const handleCancelConfirm = async (reason: string, comment: string) => {
    const ok = await cancelActiveDelivery(reason, comment || undefined);
    setShowCancel(false);
    if (ok) router.replace('/(driver)');
  };

  const markers = useMemo(() => {
    if (!activeDelivery) return [];
    const list: any[] = [
      { id: 'delivery', coordinate: activeDelivery.deliveryLocation, icon: 'delivery' },
    ];
    if (driverPos) {
      // Le livreur regarde/va vers le point de LIVRAISON.
      list.push({
        id: 'driver',
        coordinate: driverPos,
        icon: 'driver',
        target: activeDelivery.deliveryLocation,
      });
    }
    return list;
  }, [activeDelivery?.deliveryLocation, driverPos]);

  const route = useMemo<[LatLng, LatLng] | undefined>(
    () =>
      activeDelivery && driverPos
        ? [driverPos, activeDelivery.deliveryLocation]
        : undefined,
    [driverPos, activeDelivery?.deliveryLocation],
  );

  if (!activeDelivery) return null;

  return (
    <View style={styles.container}>
      <Map
        center={driverPos ?? activeDelivery.deliveryLocation}
        zoom={14}
        markers={markers}
        routeCoordinates={route}
        routePath={routePath ?? undefined}
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
          <Text style={styles.pillText}>Vers la livraison</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Livraison du colis</Text>
        <Text style={styles.recipient}>{activeDelivery.recipientName}</Text>
        <Text style={styles.address}>{activeDelivery.deliveryAddress}</Text>
        {activeDelivery.deliveryDetails && (
          <Text style={styles.details}>{activeDelivery.deliveryDetails}</Text>
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              openNavigation(
                activeDelivery.deliveryLocation.latitude,
                activeDelivery.deliveryLocation.longitude,
                activeDelivery.deliveryAddress,
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
                activeDelivery.deliveryLocation.latitude,
                activeDelivery.deliveryLocation.longitude,
              )
            }
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Je suis arrivé - Entrer le code"
          onPress={() => router.replace('/(driver)/code-validation')}
        />
        <View style={{ height: 8 }} />
        {/* Une fois le colis récupère (status >= picked_up), l'annulation
            n'est plus possible librement: le livreur s'est engage en validant
            la photo + le code de récupération. Pour annuler il doit passer
            par le support. Le bouton est grise pour le signaler clairement. */}
        <Button
          title="Annulation impossible (colis récupéré)"
          variant="outline"
          onPress={() => {}}
          disabled
        />
      </View>

      <CancelReasonDialog
        visible={showCancel}
        title="Annuler la course"
        subtitle="Si vous n'avez pas encore récupéré le colis, la course sera remise en file."
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancelConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  deliveryMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
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
  recipient: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  address: {
    ...typography.body,
    color: colors.textSecondary,
  },
  details: {
    ...typography.bodySmall,
    color: colors.textTertiary,
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
