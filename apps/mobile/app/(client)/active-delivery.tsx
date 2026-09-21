import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Dimensions,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Map, MapHandle } from '@/components/map/Map';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAnimatedPosition } from '@/hooks/useAnimatedPosition';
import { openPhone } from '@/utils/linking';
import { useMessageStore } from '@/stores/message.store';
import { formatEta, formatDistance } from '@/utils/format';
import { getDeliveryById, getDeliveryRoute, cancelDelivery } from '@/services/delivery.service';
import { getDriverById } from '@/services/driver.service';
import { LatLng } from '@/types';
import { TRACKING_BASE_URL } from '@/config/api';
import { fontFamily } from '@/theme';
import { AuroraGlow, AuroraText } from '@/components/aurora/AuroraBits';

// ---- Palette « Aurora » (clair + tech) — direction validée par le user.
// On garde les MÊMES clés que la maquette v2 pour ne rien casser côté styles ;
// seules les valeurs passent en tokens Aurora (voir theme/aurora.ts).
const D = {
  canvas: '#EEF1F4',       // AU.ground
  surface: '#FFFFFF',
  ink: '#141A1F',          // AU.ink
  muted: '#68727B',        // AU.muted
  hair: '#DCE3E8',         // hairline solide (handle, filets)
  greenDeep: '#0E7A44',    // AU.kola
  greenMid: '#12B58A',     // AU.teal
  greenBright: '#12B58A',  // AU.teal (chip/halo)
  greenSoft: 'rgba(18,181,138,0.12)', // tint teal
  stepTrack: 'rgba(20,40,50,0.10)',
};

// Polices : UNIQUEMENT des familles déjà embarquées dans le build natif
// (zéro téléchargement OTA → pas de splash bloqué sur réseau BF lent).
//  • UI         = Inter (tokens thème)
//  • chiffre ETA = Bricolage Grotesque (display géométrique, déjà chargé)
//  • code        = monospace système (toujours présent dans l'OS)
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const FONT = {
  regular: fontFamily.regular,
  medium: fontFamily.medium,
  semiBold: fontFamily.semiBold,
  bold: fontFamily.bold,
  eta: 'BricolageGrotesque_800ExtraBold',
  etaUnit: fontFamily.bold,
  code: MONO,
};

// Hauteur du bottom sheet (≈ moitié basse). Sert aussi de marge basse au
// cadrage de la carte (livreur + destination restent visibles au-dessus).
const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;
const SHEET_MAX_H = Math.min(SCREEN_H * 0.55, 460);
// Panneau Aurora flottant (marges latérales, coins arrondis, dégradé vert→teal).
const PANEL_MARGIN = 12;
const PANEL_W = SCREEN_W - PANEL_MARGIN * 2;

/** Progression grossière du trajet selon le statut (présentation seulement). */
function tripProgress(status: string): number {
  switch (status) {
    case 'accepted':
      return 0.14;
    case 'picking_up':
      return 0.34;
    case 'picked_up':
      return 0.62;
    case 'delivering':
      return 0.85;
    case 'delivered':
      return 1;
    default:
      return 0.1;
  }
}

const VEHICLE_LABEL: Record<string, string> = {
  moto: 'Moto',
  velo: 'Vélo',
  voiture: 'Voiture',
  tricycle: 'Tricycle',
};

/** Distance à vol d'oiseau (km) entre deux points GPS — repli quand l'ETA
 *  routier (OSRM) n'est pas encore disponible. */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initiales (max 2 lettres) à partir du nom complet du livreur. */
function initialsOf(name?: string): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  // Selectors atomiques pour garantir un re-render a chaque changement
  const activeDelivery = useDeliveryStore((s) => s.activeDelivery);
  const activeDriver = useDeliveryStore((s) => s.activeDriver);
  const driverLocation = useDeliveryStore((s) => s.driverLocation);
  const setActiveDelivery = useDeliveryStore((s) => s.setActiveDelivery);
  const setDriverLocation = useDeliveryStore((s) => s.setDriverLocation);
  const selectDriver = useDeliveryStore((s) => s.selectDriver);
  const unreadMessages = useMessageStore(
    (s) => s.unread[activeDelivery?.id ?? ''] ?? 0,
  );

  const delivery = activeDelivery;
  const driver = activeDriver;

  const mapRef = useRef<MapHandle>(null);

  // Respecte « réduire les animations » : coupe pulse/halo (carte + chip).
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (mounted) setReduceMotion(rm);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Itinéraire routier réel (suit les rues), calculé côté serveur via OSRM.
  // null tant qu'on n'a rien → la carte trace une ligne directe en fallback.
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
    if (delivery?.status === 'cancelled' || delivery?.status === 'expired') {
      useDeliveryStore.getState().clear();
      router.replace('/(client)');
    }
  }, [delivery?.status, router]);

  // Refetch la delivery au focus et toutes les 5s (polling backup si un event
  // socket est perdu).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      const deliveryId = activeDelivery?.id;
      if (!deliveryId) return;

      // Compteur de non-lus au (re)focus : survit au redémarrage de l'app,
      // le socket prend ensuite le relais en live.
      useMessageStore.getState().loadUnread(deliveryId);

      const refresh = async () => {
        try {
          const fresh = await getDeliveryById(deliveryId);
          if (!fresh) return;
          const current = useDeliveryStore.getState().activeDelivery;
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
          if (fresh.driverId) {
            const d = await getDriverById(fresh.driverId);
            if (d) {
              if (d.driverProfile?.currentLocation) {
                setDriverLocation(d.driverProfile.currentLocation);
              }
              // Renseigne l'objet livreur (nom/véhicule) si absent ou périmé,
              // sinon la ligne livreur reste bloquée en skeleton alors que le
              // marqueur scooter est déjà sur la carte.
              const cur = useDeliveryStore.getState().activeDriver;
              if (!cur || cur.id !== d.id) selectDriver(d);
            }
          }
          const route = await getDeliveryRoute(deliveryId);
          if (route) setRoutePath(route.path);
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

  // Phase courante : avant récupération, le livreur roule vers le point A
  // (récupération) ; après récupération, il roule vers le point B (livraison).
  const isAfterPickup =
    delivery?.status === 'picked_up' || delivery?.status === 'delivering';

  // Position live du livreur, interpolée pour une animation fluide.
  const { position: driverPos } = useAnimatedPosition(driverLocation, null);

  // Tracé du parcours, ancré sur la position RÉELLE du livreur.
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

  // Marqueurs : pickup + delivery + (livreur si connu)
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
        label: `🏠 Livraison — ${delivery.deliveryAddress}`,
      },
    ];
    if (driverPos) {
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

  const mapCenter = driverPos ??
    delivery?.pickupLocation ?? { latitude: 12.3714, longitude: -1.5197 };

  if (!delivery) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.noDelivery}>Aucune livraison active</Text>
      </SafeAreaView>
    );
  }

  // ----- valeurs dérivées du statut -----
  const status = delivery.status;
  const isDelivered = status === 'delivered';
  // Annulation client : possible tant que la course n'est pas terminée. Sinon le
  // client restait coincé si le livreur acceptait puis ne venait jamais.
  const canCancel =
    status !== 'delivered' && status !== 'cancelled' && status !== 'expired';
  const handleCancel = () => {
    if (cancelling) return;
    Alert.alert(
      'Annuler la course',
      'Voulez-vous vraiment annuler cette course ?',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler la course',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelDelivery(delivery.id, 'client_cancel');
              setActiveDelivery(null);
              router.replace('/(client)');
            } catch (e: any) {
              const code = e?.response?.data?.error?.code;
              Alert.alert(
                'Annulation impossible',
                code === 'CANCEL_COOLDOWN'
                  ? "Patientez un court instant avant de pouvoir annuler."
                  : "Impossible d'annuler pour le moment. Réessayez.",
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };
  const inProgress = [
    'accepted',
    'picking_up',
    'picked_up',
    'delivering',
  ].includes(status);

  const pillLabel =
    status === 'accepted' || status === 'picking_up'
      ? 'Livreur en route'
      : status === 'picked_up' || status === 'delivering'
        ? 'En livraison'
        : isDelivered
          ? 'Livré'
          : 'En cours';

  // Stepper horizontal (3 étapes chronologiques) :
  //   0 Récupéré (récup du colis) · 1 En route · 2 Livré
  const activeStep =
    status === 'accepted' || status === 'picking_up'
      ? 0
      : status === 'picked_up' || status === 'delivering'
        ? 1
        : isDelivered
          ? 2
          : 0;
  const steps = ['Récupéré', 'En route', 'Livré'];

  // Hero ETA
  const etaSeconds = delivery.eta?.durationSeconds;
  const etaMin =
    etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;
  const distLabel = delivery.eta
    ? formatDistance(delivery.eta.distanceMeters / 1000)
    : null;
  // Repli quand l'ETA routier n'est pas (encore) calculé : distance à vol
  // d'oiseau du livreur vers la cible de la phase courante.
  const here = driverPos ?? driverLocation;
  const fallbackTarget = isAfterPickup
    ? delivery.deliveryLocation
    : delivery.pickupLocation;
  const fallbackDist =
    etaMin == null && here && inProgress
      ? formatDistance(haversineKm(here, fallbackTarget))
      : null;

  // Code de livraison / récupération
  const showPickupCode =
    (status === 'accepted' || status === 'picking_up') &&
    !!delivery.pickupValidationCode;
  const showDeliveryCode = status === 'picked_up' || status === 'delivering';
  const showCode = showPickupCode || showDeliveryCode;
  const codeValue = showPickupCode
    ? delivery.pickupValidationCode
    : delivery.validationCode;
  const codeTitle = showPickupCode ? 'CODE DE RÉCUPÉRATION' : 'CODE DE LIVRAISON';
  const codeHint = showPickupCode
    ? delivery.senderContactName
      ? `À communiquer à ${delivery.senderContactName}.`
      : 'À donner au livreur lors de la récupération.'
    : 'À communiquer au destinataire à la livraison.';

  const canShare = !!delivery.trackingToken && inProgress;
  const vehicleLabel =
    VEHICLE_LABEL[driver?.driverProfile?.vehicleType ?? ''] ?? 'Scooter';

  // Position du livreur indisponible alors qu'une livraison est en cours.
  const positionStale = inProgress && !driverLocation;

  const onShare = async () => {
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
  };

  // ----- Panneau Aurora : héros (distance restante) + arrivée -----
  const bigDist = distLabel ?? fallbackDist; // "5,6 km" | "550 m" | null
  const [dNum, dUnit] = bigDist ? bigDist.split(' ') : [null, null];
  const etaShort =
    etaMin != null ? (etaMin < 60 ? `${etaMin}′` : formatEta(etaSeconds!)) : null;
  // Héros = distance si connue, sinon l'ETA en repli.
  const heroLabel = bigDist ? 'DISTANCE RESTANTE' : 'ARRIVÉE ESTIMÉE';
  const heroNum = bigDist ? dNum! : etaShort ?? '—';
  const heroUnit = bigDist ? dUnit ?? '' : bigDist ? '' : etaShort ? '' : '';
  const heroW = Math.max(120, String(heroNum).length * 42 + 12);
  const pct = Math.round(tripProgress(status) * 100);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Map
        ref={mapRef}
        center={mapCenter}
        zoom={14}
        theme="soft"
        markers={mapMarkers}
        routeCoordinates={routeCoords}
        routePath={routePath ?? undefined}
        reducedMotion={reduceMotion}
        fitToContent
        contentInsetTop={120}
        contentInsetBottom={SHEET_MAX_H + 30}
      />

      {/* Back + chip statut */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backCircle}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={D.ink} />
        </TouchableOpacity>
        <View style={styles.statusChip}>
          <View style={styles.chipDotWrap}>
            {!reduceMotion && <View style={styles.chipDotHalo} />}
            <View style={styles.chipDot} />
          </View>
          <Text style={styles.chipText}>{pillLabel}</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Recentrer (bas-droite de la carte, au-dessus du sheet) */}
      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: SHEET_MAX_H + 16 }]}
        onPress={() => mapRef.current?.recenter()}
        accessibilityLabel="Recentrer sur le livreur"
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <Ionicons name="locate" size={20} color={D.greenDeep} />
      </TouchableOpacity>

      {/* Bandeau discret : position en cours d'actualisation */}
      {positionStale && (
        <View style={[styles.staleBanner, { bottom: SHEET_MAX_H + 16 }]}>
          <Ionicons name="navigate-circle-outline" size={15} color={D.muted} />
          <Text style={styles.staleText}>Position en cours d'actualisation</Text>
        </View>
      )}

      {/* Panneau Aurora flottant (mockup validé) */}
      <View style={styles.sheet}>
        {/* fond dégradé aurore vert→teal, clippé aux coins arrondis */}
        <AuroraGlow width={PANEL_W} height={380} opacity={1} style={{ position: 'absolute', top: -20, left: 0 }} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
        >
          {isDelivered ? (
            <View style={styles.heroDone}>
              <View style={styles.heroDoneBadge}>
                <Ionicons name="checkmark" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.heroDoneTitle}>Colis livré</Text>
                <Text style={styles.heroDoneSub}>Merci d'avoir utilisé Toolé</Text>
              </View>
            </View>
          ) : (
            <>
              {/* a) Héros : distance restante (dégradé) + arrivée */}
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>{heroLabel}</Text>
                  <View style={styles.heroNumRow}>
                    <AuroraText
                      id="heroBig"
                      width={heroW}
                      height={58}
                      fontSize={52}
                      fontFamily={FONT.eta}
                      align="left"
                      letterSpacing={-2}
                    >
                      {String(heroNum)}
                    </AuroraText>
                    {heroUnit ? <Text style={styles.heroUnit}>{heroUnit}</Text> : null}
                  </View>
                </View>
                {bigDist && etaShort ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.eyebrow}>ARRIVÉE</Text>
                    <Text style={styles.etaSide}>{etaShort}</Text>
                  </View>
                ) : null}
              </View>

              {/* b) Barre de progression */}
              <View style={styles.progTrack}>
                <View style={[styles.progFill, { width: `${pct}%` }]} />
              </View>
            </>
          )}

          {/* c) Ligne livreur */}
          {driver ? (
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(driver.fullName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {driver.fullName}
                </Text>
                <Text style={styles.driverSub} numberOfLines={1}>
                  Ton livreur · {vehicleLabel}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconBtnGlass}
                onPress={() =>
                  router.push(
                    `/chat/${delivery.id}?name=${encodeURIComponent(
                      driver.fullName,
                    )}&reference=${encodeURIComponent(delivery.reference)}` as any,
                  )
                }
                accessibilityLabel="Envoyer un message au livreur"
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={19} color={D.greenDeep} />
                {unreadMessages > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtnFilled}
                onPress={() => openPhone(driver.phone)}
                accessibilityLabel="Appeler le livreur"
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={19} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <SheetSkeleton />
          )}

          {/* d) Code */}
          {showCode && !isDelivered ? (
            <>
              <View style={styles.hairline} />
              <View style={styles.codeRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.codeLabel}>{codeTitle}</Text>
                  <Text style={styles.codeHint}>{codeHint}</Text>
                </View>
                <AuroraText
                  id="codeGrad"
                  width={Math.max(110, String(codeValue ?? '').length * 28 + 16)}
                  height={50}
                  fontSize={42}
                  fontFamily={FONT.code}
                  align="right"
                  letterSpacing={4}
                >
                  {String(codeValue ?? '')}
                </AuroraText>
              </View>
            </>
          ) : null}

          {/* e) Actions secondaires (compactes) */}
          {isDelivered ? (
            <TouchableOpacity
              style={styles.ctaGhost}
              activeOpacity={0.88}
              onPress={() => router.replace('/(client)/delivery-complete')}
            >
              <Ionicons name="receipt-outline" size={18} color={D.greenDeep} />
              <Text style={styles.ctaText}>Voir le récapitulatif</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerRow}>
              {canShare ? (
                <TouchableOpacity
                  style={styles.footerLink}
                  activeOpacity={0.7}
                  onPress={onShare}
                  accessibilityRole="button"
                  accessibilityLabel="Partager le suivi"
                >
                  <Ionicons name="share-social-outline" size={16} color={D.greenDeep} />
                  <Text style={styles.footerLinkText}>Partager</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              {canCancel ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCancel}
                  disabled={cancelling}
                  accessibilityRole="button"
                  accessibilityLabel="Annuler la course"
                >
                  <Text style={styles.cancelLinkText}>
                    {cancelling ? 'Annulation…' : 'Annuler la course'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/** Skeleton sobre du bloc livreur pendant la 1re récupération. */
function SheetSkeleton() {
  return (
    <View style={styles.driverRow}>
      <View style={[styles.avatar, styles.skelBlock]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skelBlock, { height: 16, width: '55%', borderRadius: 6 }]} />
        <View style={[styles.skelBlock, { height: 12, width: '40%', borderRadius: 6 }]} />
      </View>
      <View style={[styles.skelBlock, { width: 46, height: 46, borderRadius: 14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.canvas },
  emptyContainer: { flex: 1, backgroundColor: D.canvas, justifyContent: 'center' },
  noDelivery: {
    color: D.muted,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: FONT.medium,
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
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16140F',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#16140F',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  chipDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.greenBright,
  },
  chipDotHalo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: D.greenBright,
    opacity: 0.35,
  },
  chipText: { color: D.ink, fontFamily: FONT.semiBold, fontSize: 13.5 },

  // ---- recenter ----
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16140F',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  // ---- stale banner ----
  staleBanner: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#16140F',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  staleText: { color: D.muted, fontFamily: FONT.medium, fontSize: 12 },

  // ---- panneau Aurora flottant ----
  sheet: {
    position: 'absolute',
    bottom: 10,
    left: PANEL_MARGIN,
    right: PANEL_MARGIN,
    backgroundColor: '#DCEFE1',
    borderRadius: 28,
    overflow: 'hidden',
    maxHeight: SHEET_MAX_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#0E3A28',
    shadowOpacity: 0.2,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  sheetContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 },

  // ---- héros distance ----
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroNumRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  heroUnit: {
    color: D.greenDeep,
    fontFamily: FONT.bold,
    fontSize: 20,
    lineHeight: 30,
    marginLeft: 4,
    marginBottom: 6,
  },
  etaSide: {
    color: D.ink,
    fontFamily: FONT.eta,
    fontSize: 26,
    lineHeight: 34,
    marginTop: 2,
  },

  // ---- barre de progression ----
  progTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(14,58,40,0.12)',
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 4,
  },
  progFill: { height: 7, borderRadius: 4, backgroundColor: D.greenMid },

  // ---- actions compactes ----
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerLinkText: { color: D.greenDeep, fontFamily: FONT.semiBold, fontSize: 13.5 },
  ctaGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  iconBtnGlass: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  // ---- a) hero ETA ----
  hero: { marginBottom: 4 },
  eyebrow: {
    color: D.muted,
    fontFamily: FONT.semiBold,
    fontSize: 11.5,
    letterSpacing: 1.6,
  },
  etaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 },
  etaValue: {
    color: D.greenDeep,
    fontFamily: FONT.eta,
    fontSize: 30,
    lineHeight: 34,
  },
  etaUnit: {
    color: D.greenDeep,
    fontFamily: FONT.etaUnit,
    fontSize: 16,
    lineHeight: 26,
  },
  etaDist: {
    color: D.muted,
    fontFamily: FONT.medium,
    fontSize: 13,
    lineHeight: 24,
  },
  etaPending: {
    color: D.ink,
    fontFamily: FONT.bold,
    fontSize: 20,
    marginTop: 2,
  },

  heroDone: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  heroDoneBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDoneTitle: { color: D.greenDeep, fontFamily: FONT.bold, fontSize: 22 },
  heroDoneSub: { color: D.muted, fontFamily: FONT.medium, fontSize: 13, marginTop: 2 },

  // ---- b) stepper ----
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    marginBottom: 4,
  },
  stepCol: { alignItems: 'center', width: 64 },
  stepDotWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  stepHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: D.greenBright,
    opacity: 0.25,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: D.stepTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: D.greenMid },
  stepDotDone: { backgroundColor: D.greenDeep },
  stepDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  stepLabel: {
    color: D.muted,
    fontFamily: FONT.medium,
    fontSize: 12.5,
    marginTop: 7,
  },
  stepLabelActive: { color: D.ink, fontFamily: FONT.bold },
  stepTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: D.stepTrack,
    marginTop: 11,
    overflow: 'hidden',
  },
  stepTrackFill: { height: 3, backgroundColor: D.greenDeep },

  // ---- filet ----
  hairline: { height: 1, backgroundColor: D.hair, marginVertical: 16 },

  // ---- d) driver row ----
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: D.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: FONT.bold, fontSize: 16 },
  driverName: { color: D.ink, fontFamily: FONT.bold, fontSize: 16 },
  driverSub: { color: D.muted, fontFamily: FONT.medium, fontSize: 13, marginTop: 2 },
  iconBtnOutline: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: D.greenDeep,
    backgroundColor: 'transparent',
  },
  iconBtnFilled: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: D.greenDeep,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: D.canvas,
  },
  unreadText: { color: '#fff', fontFamily: FONT.bold, fontSize: 10.5 },

  // ---- f) code ----
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeLabel: {
    color: D.ink,
    fontFamily: FONT.bold,
    fontSize: 12.5,
    letterSpacing: 1.2,
  },
  codeHint: { color: D.muted, fontFamily: FONT.regular, fontSize: 12.5, marginTop: 3 },
  codeValue: {
    color: D.greenDeep,
    fontFamily: FONT.code,
    fontWeight: '700',
    fontSize: 36,
    letterSpacing: 4,
  },

  // ---- g) CTA ----
  ctaOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: D.greenDeep,
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 16,
  },
  ctaText: { color: D.greenDeep, fontFamily: FONT.bold, fontSize: 15.5 },
  cancelLink: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelLinkText: { color: '#B42318', fontFamily: FONT.medium, fontSize: 14 },

  // ---- skeleton ----
  skelBlock: { backgroundColor: D.hair },
});
