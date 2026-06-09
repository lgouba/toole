import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAnimatedPosition } from '@/hooks/useAnimatedPosition';
import { openPhone } from '@/utils/linking';
import { shareLocationWhatsApp } from '@/utils/linking';
import { formatEta, formatDistance, formatRating } from '@/utils/format';
import { getDeliveryById } from '@/services/delivery.service';
import { getDriverById } from '@/services/driver.service';
import { LatLng } from '@/types';
import { TRACKING_BASE_URL } from '@/config/api';

// Palette claire (cohérente avec le reste de l'app)
const D = {
  bg: '#FFFFFF',
  sheet: '#FFFFFF',
  surface: '#F1F5F9',
  surfaceStrong: '#E2E8F0',
  border: '#E8EDF3',
  text: '#0F172A',
  textMuted: '#64748B',
  green: '#16A34A',
  greenDeep: '#15803D',
  greenGlow: '#E7FBEF',
  star: '#F59E0B',
};

const RIDER_AVATAR = require('@/assets/images/rider/rider-avatar.png');

// Hauteur max du bottom sheet (≈ moitié basse). Sert aussi de marge basse pour
// le cadrage de la carte (le livreur reste visible au-dessus du sheet).
const SCREEN_H = Dimensions.get('window').height;
const SHEET_RATIO = 0.52;
const SHEET_MAX_H = SCREEN_H * SHEET_RATIO;

const VEHICLE_LABEL: Record<string, string> = {
  moto: 'Moto',
  velo: 'Vélo',
  voiture: 'Voiture',
  tricycle: 'Tricycle',
};

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

  // Quand la livraison devient 'delivered', on bascule sur l'écran de notation.
  // L'écran delivery-complete demande une note + un commentaire, puis clear().
  const hasNavigatedToCompleteRef = useRef(false);
  useEffect(() => {
    if (delivery?.status === 'delivered' && !hasNavigatedToCompleteRef.current) {
      hasNavigatedToCompleteRef.current = true;
      router.replace('/(client)/delivery-complete');
    }
  }, [delivery?.status, router]);

  // Si la livraison est annulée / expirée, on revient a l'accueil proprement.
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
  // socket est perdu). Descendu a 5s car la rapidite de mise a jour de l'écran
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
          // Ne set que si le statut a vraiment change pour éviter des re-renders inutiles
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
          // Position du livreur : rafraîchie à CHAQUE cycle (pas seulement au
          // premier), pour que le client voie le livreur se déplacer même si un
          // event socket est perdu (réseau BF instable). Le backend stocke la
          // dernière position GPS poussée par le livreur (~10s).
          if (fresh.driverId) {
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

  // Phase courante : avant récupération, le livreur roule vers le point A
  // (récupération) ; après récupération, il roule vers le point B (livraison).
  const isAfterPickup =
    delivery?.status === 'picked_up' || delivery?.status === 'delivering';

  // Position live du livreur, interpolée pour une animation fluide entre chaque
  // mise à jour (~10s socket / 5s polling). PAS de fallback sur le pickup : tant
  // qu'on n'a pas reçu sa vraie position, on n'affiche pas le marqueur livreur
  // (sinon on ferait croire qu'il est déjà au point de récupération).
  const { position: driverPos } = useAnimatedPosition(driverLocation, null);

  // Tracé du parcours, ancré sur la position RÉELLE du livreur :
  //  • avant récupération : livreur (C) → récupération (A)
  //  • après récupération  : livreur      → livraison (B)
  // Tant que la position du livreur est inconnue, on montre au moins A → B.
  const routeCoords = useMemo<[LatLng, LatLng] | undefined>(() => {
    if (!delivery) return undefined;
    const phaseTarget = isAfterPickup
      ? delivery.deliveryLocation
      : delivery.pickupLocation;
    if (driverLocation) return [driverLocation, phaseTarget];
    return [delivery.pickupLocation, delivery.deliveryLocation];
  }, [
    delivery?.pickupLocation,
    delivery?.deliveryLocation,
    driverLocation,
    isAfterPickup,
  ]);

  // Marqueurs : toujours afficher pickup + delivery + (livreur si connu)
  const mapMarkers = useMemo(() => {
    if (!delivery) return [];
    const list: Array<{
      id: string;
      coordinate: LatLng;
      icon: 'pickup' | 'delivery' | 'driver';
      label?: string;
      target?: LatLng;
    }> = [
      {
        id: 'pickup',
        coordinate: delivery.pickupLocation,
        icon: 'pickup',
        label: `📦 Récupération — ${delivery.pickupAddress}`,
      },
      {
        id: 'delivery',
        coordinate: delivery.deliveryLocation,
        icon: 'delivery',
        label: `🏁 Livraison — ${delivery.deliveryAddress}`,
      },
    ];
    if (driverPos) {
      // Le livreur regarde la cible de la phase courante : récup tant que le
      // colis n'est pas pris, puis livraison.
      const target = isAfterPickup
        ? delivery.deliveryLocation
        : delivery.pickupLocation;
      list.push({
        id: 'driver',
        coordinate: driverPos,
        icon: 'driver',
        label: '🛵 Votre livreur',
        target,
      });
    }
    return list;
  }, [driverPos, delivery?.pickupLocation, delivery?.deliveryLocation, isAfterPickup]);

  // Centre la carte sur le livreur tant qu'il bouge, sinon sur pickup
  const mapCenter = driverPos ?? delivery?.pickupLocation ?? {
    latitude: 12.3714,
    longitude: -1.5197,
  };

  if (!delivery) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.noDelivery}>Aucune livraison active</Text>
      </SafeAreaView>
    );
  }

  // ----- valeurs dérivées du statut -----
  const status = delivery.status;
  const pillLabel =
    status === 'accepted' || status === 'picking_up'
      ? 'Livreur en route'
      : status === 'picked_up' || status === 'delivering'
        ? 'En livraison'
        : status === 'delivered'
          ? 'Livré'
          : 'En cours';

  const activeStep =
    status === 'accepted' || status === 'picking_up'
      ? 0
      : status === 'picked_up' || status === 'delivering'
        ? 1
        : status === 'delivered'
          ? 2
          : 0;

  const steps = [
    { icon: 'bike-fast', label: 'Livreur en route vers vous' },
    { icon: 'package-variant-closed', label: 'Colis récupéré, en livraison' },
    { icon: 'check-all', label: 'Livré' },
  ] as const;

  const showPickupCode =
    (status === 'accepted' || status === 'picking_up') &&
    !!delivery.pickupValidationCode;
  const showDeliveryCode = status === 'picked_up' || status === 'delivering';
  const codeValue = showPickupCode
    ? delivery.pickupValidationCode
    : delivery.validationCode;
  const codeTitle = showPickupCode ? 'CODE DE RÉCUPÉRATION' : 'CODE DE LIVRAISON';
  const codeHint = showPickupCode
    ? delivery.senderContactName
      ? `À communiquer à ${delivery.senderContactName} pour la récupération.`
      : 'À donner au livreur lors de la récupération'
    : 'À communiquer au destinataire pour la livraison';

  const canShare =
    !!delivery.trackingToken &&
    ['accepted', 'picking_up', 'picked_up', 'delivering'].includes(status);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Map
        center={mapCenter}
        zoom={14}
        markers={mapMarkers}
        routeCoordinates={routeCoords}
        fitToContent
        contentInsetTop={120}
        contentInsetBottom={SHEET_MAX_H + 30}
      />

      {/* Back + pill statut */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="arrow-back" size={20} color={D.text} />
        </TouchableOpacity>
        <View style={styles.statusPill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>{pillLabel}</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Bottom sheet sombre */}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
        >
          {/* Header livreur */}
          {driver && (
            <View style={styles.driverRow}>
              <View style={styles.avatarRing}>
                <Image source={RIDER_AVATAR} style={styles.avatarImg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {driver.fullName}
                </Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color={D.star} />
                  <Text style={styles.driverMeta}>
                    {(() => {
                      const r = formatRating(driver.ratingAvg, driver.ratingCount);
                      return r.hasRatings ? r.value : 'Nouveau';
                    })()}{' '}
                    · {VEHICLE_LABEL[driver.driverProfile.vehicleType] ?? 'Scooter'}
                  </Text>
                </View>
              </View>
              {delivery.eta &&
              ['accepted', 'picking_up', 'picked_up', 'delivering'].includes(
                status,
              ) ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.etaBig}>
                    {formatEta(delivery.eta.durationSeconds)}
                  </Text>
                  <Text style={styles.etaDist}>
                    {formatDistance(delivery.eta.distanceMeters / 1000)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Actions appel / whatsapp */}
          {driver && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => openPhone(driver.phone)}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={17} color={D.green} />
                <Text style={styles.actionText}>Appeler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  const loc = driverPos ?? delivery.deliveryLocation;
                  shareLocationWhatsApp(
                    delivery.recipientPhone,
                    delivery.reference,
                    loc.latitude,
                    loc.longitude,
                  );
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
                <Text style={styles.actionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Timeline */}
          <View style={styles.timeline}>
            {steps.map((s, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              const reached = done || active;
              return (
                <View key={s.icon} style={styles.tlRow}>
                  <View style={styles.tlIconCol}>
                    <View
                      style={[
                        styles.tlCircle,
                        active && styles.tlCircleActive,
                        done && styles.tlCircleDone,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={s.icon as any}
                        size={18}
                        color={reached ? '#fff' : D.textMuted}
                      />
                    </View>
                    {i < steps.length - 1 && (
                      <View
                        style={[styles.tlLine, done && styles.tlLineDone]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tlLabel,
                      reached && styles.tlLabelActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Code */}
          {showPickupCode || showDeliveryCode ? (
            <View style={styles.codeCard}>
              <Text style={styles.codeTitle}>{codeTitle}</Text>
              <Text style={styles.codeValue}>{codeValue}</Text>
              <Text style={styles.codeHint}>{codeHint}</Text>
            </View>
          ) : null}

          {/* Partager le suivi */}
          {canShare ? (
            <TouchableOpacity
              style={styles.shareBtn}
              activeOpacity={0.88}
              onPress={async () => {
                const url = `${TRACKING_BASE_URL}/track/${delivery.trackingToken}`;
                const message = `Bonjour ${delivery.recipientName}, voici le suivi en direct de votre livraison Toolé (réf. ${delivery.reference}) : ${url}`;
                try {
                  await Share.share({ message, url });
                } catch (err) {
                  console.warn('[active-delivery] share failed', err);
                  Alert.alert(
                    'Partage impossible',
                    'Le partage du suivi a échoué. Réessayez ou copiez le lien manuellement.',
                  );
                }
              }}
            >
              <Ionicons name="share-social" size={19} color="#fff" />
              <Text style={styles.shareBtnText}>
                Partager le suivi au destinataire
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },
  emptyContainer: { flex: 1, backgroundColor: D.bg, justifyContent: 'center' },
  noDelivery: {
    color: D.textMuted,
    textAlign: 'center',
    fontSize: 15,
  },

  // ---- top bar ----
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.green,
  },
  pillText: { color: D.text, fontWeight: '700', fontSize: 14 },

  // ---- bottom sheet ----
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: D.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    maxHeight: SHEET_MAX_H,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 28 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: D.surfaceStrong,
    alignSelf: 'center',
    marginBottom: 18,
  },

  // ---- driver header ----
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: D.green,
    backgroundColor: D.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 56, height: 56 },
  driverName: { color: D.text, fontSize: 19, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  driverMeta: { color: D.textMuted, fontSize: 14, fontWeight: '600' },
  etaBig: { color: D.green, fontSize: 24, fontWeight: '800' },
  etaDist: { color: D.textMuted, fontSize: 13, marginTop: 1 },

  // ---- actions ----
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
  },
  actionText: { color: D.text, fontWeight: '700', fontSize: 14 },

  // ---- timeline ----
  timeline: { marginTop: 22 },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tlIconCol: { alignItems: 'center', width: 44 },
  tlCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlCircleActive: {
    backgroundColor: D.green,
    borderColor: D.green,
    shadowColor: D.green,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  tlCircleDone: { backgroundColor: D.greenDeep, borderColor: D.greenDeep },
  tlLine: { width: 2, height: 26, backgroundColor: D.border, marginVertical: 2 },
  tlLineDone: { backgroundColor: D.greenDeep },
  tlLabel: {
    flex: 1,
    color: D.textMuted,
    fontSize: 16,
    fontWeight: '700',
    paddingTop: 11,
    marginLeft: 14,
  },
  tlLabelActive: { color: D.text },

  // ---- code ----
  codeCard: {
    marginTop: 22,
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: D.greenGlow,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.25)',
  },
  codeTitle: {
    color: D.greenDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  codeValue: {
    color: D.greenDeep,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 12,
    marginVertical: 8,
  },
  codeHint: { color: D.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },

  // ---- share ----
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: D.greenDeep,
    paddingVertical: 17,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: D.green,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
