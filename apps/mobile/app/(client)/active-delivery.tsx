import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { DeliveryStatusStepper } from '@/components/delivery';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAnimatedPosition } from '@/hooks/useAnimatedPosition';
import { openPhone } from '@/utils/linking';
import { shareLocationWhatsApp } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { getDriverById } from '@/services/driver.service';
import { LatLng } from '@/types';

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  // Selectors atomiques pour garantir un re-render a chaque changement
  const activeDelivery = useDeliveryStore((s) => s.activeDelivery);
  const activeDriver = useDeliveryStore((s) => s.activeDriver);
  const driverLocation = useDeliveryStore((s) => s.driverLocation);
  const setActiveDelivery = useDeliveryStore((s) => s.setActiveDelivery);
  const setDriverLocation = useDeliveryStore((s) => s.setDriverLocation);

  const delivery = activeDelivery;
  const driver = activeDriver;

  // Trace chaque changement de status pour debug in-app
  useEffect(() => {
    if (delivery?.status) {
      console.log(
        '[ActiveDelivery] status =',
        delivery.status,
        'deliveryId =',
        delivery.id,
      );
    }
  }, [delivery?.status, delivery?.id]);

  // Quand la livraison devient 'delivered', on bascule sur l'ecran de notation.
  // L'ecran delivery-complete demande une note + un commentaire, puis clear().
  const hasNavigatedToCompleteRef = useRef(false);
  useEffect(() => {
    if (delivery?.status === 'delivered' && !hasNavigatedToCompleteRef.current) {
      hasNavigatedToCompleteRef.current = true;
      router.replace('/(client)/delivery-complete');
    }
  }, [delivery?.status, router]);

  // Si la livraison est annulee / expiree, on revient a l'accueil proprement.
  useEffect(() => {
    if (
      delivery?.status === 'cancelled' ||
      delivery?.status === 'expired'
    ) {
      useDeliveryStore.getState().clear();
      router.replace('/(client)');
    }
  }, [delivery?.status, router]);

  // Refetch la delivery au focus et toutes les 5s (polling backup si un event
  // socket est perdu). Descendu a 5s car la rapidite de mise a jour de l'ecran
  // client a plus de valeur que l'economie de bande passante.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      const deliveryId = activeDelivery?.id;
      if (!deliveryId) return;

      const refresh = async () => {
        try {
          const fresh = await getDeliveryById(deliveryId);
          if (!fresh) return;
          const current = useDeliveryStore.getState().activeDelivery;
          // Ne set que si le statut a vraiment change pour eviter des re-renders inutiles
          if (
            !current ||
            current.status !== fresh.status ||
            current.updatedAt !== fresh.updatedAt
          ) {
            console.log(
              '[ActiveDelivery] polling detected change, new status =',
              fresh.status,
            );
            setActiveDelivery(fresh);
          }
          // Si la position du livreur est connue cote backend mais pas encore en store
          if (fresh.driverId && !useDeliveryStore.getState().driverLocation) {
            const d = await getDriverById(fresh.driverId);
            if (d?.driverProfile?.currentLocation) {
              setDriverLocation(d.driverProfile.currentLocation);
            }
          }
        } catch (err) {
          console.warn('[ActiveDelivery] refresh failed', err);
        }
      };

      refresh();
      intervalRef.current = setInterval(refresh, 5_000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDelivery?.id]),
  );

  useEffect(() => {
    if (driverLocation) {
      console.log('[ActiveDelivery] driverLocation updated', driverLocation);
    }
  }, [driverLocation]);

  // Position reelle du livreur, interpolee pour une animation fluide
  // entre chaque heartbeat (~10s). Tant qu'on n'a pas encore recu la
  // premiere position, on se base sur pickup comme fallback visuel.
  const fallback: LatLng | null = delivery?.pickupLocation ?? null;
  const { position: driverPos } = useAnimatedPosition(
    driverLocation,
    fallback,
  );

  // Toujours afficher le trajet complet pickup -> delivery. Le livreur
  // apparait en plus sur la carte a sa position courante et se deplace
  // le long (en principe) de ce trajet.
  const routeCoords = useMemo<[LatLng, LatLng] | undefined>(() => {
    if (!delivery) return undefined;
    return [delivery.pickupLocation, delivery.deliveryLocation];
  }, [delivery?.pickupLocation, delivery?.deliveryLocation]);

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
        fitToContent
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

        {/* Carte d'info contextuelle selon le statut */}
        {(delivery.status === 'accepted' || delivery.status === 'picking_up') &&
        delivery.pickupValidationCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Code de recuperation</Text>
            <Text style={styles.codeValue}>{delivery.pickupValidationCode}</Text>
            <Text style={styles.codeHint}>
              {delivery.senderContactName
                ? `Communiquez ce code a ${delivery.senderContactName} pour qu'il le donne au livreur au moment de la recuperation.`
                : "A donner au livreur au moment de la recuperation du colis."}
            </Text>
          </View>
        ) : delivery.status === 'picked_up' ||
          delivery.status === 'delivering' ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Code de livraison</Text>
            <Text style={styles.codeValue}>{delivery.validationCode}</Text>
            <Text style={styles.codeHint}>
              Communiquez ce code au destinataire pour qu'il le remette au livreur
            </Text>
          </View>
        ) : null}
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 19,
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
