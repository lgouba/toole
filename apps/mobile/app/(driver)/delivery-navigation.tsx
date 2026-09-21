import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, withTiming, useReducedMotion, useAnimatedStyle } from 'react-native-reanimated';
import { useDriverStore } from '@/stores/driver.store';
import { useMessageStore } from '@/stores/message.store';
import { openPhone, openNavigation } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { formatEta } from '@/utils/format';
import { Map } from '@/components/map/Map';
import { LatLng } from '@/types';
import { AU, AF } from '@/theme/aurora';
import { AuroraGlow, GradientButton } from '@/components/aurora/AuroraBits';

// Distance en « bon de course » (§5.8) — LOCAL, ne touche pas formatDistance global.
function fmtDistBon(km: number): string {
  if (km < 0.06) return 'SUR PLACE';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function DeliveryNavigationScreen() {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { activeDelivery } = useDriverStore();
  const currentLocation = useDriverStore((s) => s.currentLocation);
  const unread = useMessageStore((s) => s.unread[activeDelivery?.id ?? ''] ?? 0);

  const stepStartRef = useRef<{ id: string; init: number } | null>(null);
  const prevRef = useRef(0);
  const [pourcent, setPourcent] = useState<number | null>(null);
  const progress = useSharedValue(0);

  // ---------- LOGIQUE INCHANGÉE ----------
  useEffect(() => {
    if (activeDelivery?.id) useMessageStore.getState().loadUnread(activeDelivery.id);
  }, [activeDelivery?.id]);

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
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeDelivery?.id, router]);

  const restKm = activeDelivery?.eta ? activeDelivery.eta.distanceMeters / 1000 : null;

  useEffect(() => {
    const id = activeDelivery?.id;
    if (!id || restKm == null) {
      setPourcent(null);
      return;
    }
    if (!stepStartRef.current || stepStartRef.current.id !== id) {
      stepStartRef.current = { id, init: restKm };
      prevRef.current = 0;
    }
    const init = stepStartRef.current.init;
    if (init <= 0) {
      setPourcent(null);
      return;
    }
    const val = Math.max(prevRef.current, Math.min(1, Math.max(0, 1 - restKm / init)));
    prevRef.current = val;
    setPourcent(Math.round(val * 100));
    progress.value = reduceMotion ? val : withTiming(val, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDelivery?.id, restKm]);

  // ---------- CARTE (affichage seulement, données existantes) ----------
  const d = activeDelivery;
  const markers = useMemo(() => {
    if (!d) return [];
    const list: any[] = [{ id: 'delivery', coordinate: d.deliveryLocation, icon: 'delivery', label: d.deliveryAddress }];
    if (currentLocation) list.push({ id: 'driver', coordinate: currentLocation, icon: 'driver', target: d.deliveryLocation });
    return list;
  }, [d?.deliveryLocation, currentLocation]);
  const routeCoords = useMemo<[LatLng, LatLng] | undefined>(
    () => (d && currentLocation ? [currentLocation, d.deliveryLocation] : undefined),
    [d?.deliveryLocation, currentLocation],
  );

  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));

  if (!d) return null;
  const center = currentLocation ?? d.deliveryLocation;

  return (
    <View style={{ flex: 1, backgroundColor: AU.ground }}>
      <Map
        center={center}
        zoom={15}
        theme="soft"
        markers={markers}
        routeCoordinates={routeCoords}
        reducedMotion={reduceMotion}
        fitToContent
        contentInsetTop={90}
        contentInsetBottom={330}
      />

      {/* header flottant */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={20} color={AU.ink} />
        </Pressable>
        <View style={styles.stepChip}>
          <Text style={styles.stepChipText}>ÉTAPE 3 / 4</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* panneau Aurora flottant */}
      <View style={styles.panel}>
        <AuroraGlow width={W - 24} height={360} opacity={1} style={{ position: 'absolute', top: -20, left: 0 }} />

        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>COLIS À BORD · LIVRAISON</Text>
            <Text numberOfLines={1} style={styles.name}>{d.recipientName}</Text>
            <Text numberOfLines={1} style={styles.details}>{d.deliveryAddress}</Text>
          </View>
        </View>

        <View style={styles.progWrap}>
          <View style={styles.progTrack}>
            <Animated.View style={[styles.progFill, barStyle]} />
          </View>
          {pourcent != null ? <Text style={styles.progPct}>{`${pourcent}%`}</Text> : null}
        </View>

        <View style={styles.statRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statK}>ARRIVÉE</Text>
            <Text style={styles.statV}>{d.eta ? formatEta(d.eta.durationSeconds) : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statK}>DISTANCE</Text>
            <Text style={styles.statV}>{restKm != null ? fmtDistBon(restKm) : '—'}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <RoundAction icon="navigate" label="Itinéraire" onPress={() => openNavigation(d.deliveryLocation.latitude, d.deliveryLocation.longitude, d.deliveryAddress)} />
          <RoundAction icon="call" label="Appeler" onPress={() => openPhone(d.recipientPhone)} />
          <RoundAction icon="chatbubble-ellipses" label="Message" badge={unread} onPress={() => router.push(`/chat/${d.id}?name=${encodeURIComponent(d.senderName ?? 'Client')}&reference=${encodeURIComponent(d.reference)}` as any)} />
        </View>

        <GradientButton label="Je suis arrivé" icon="checkmark" onPress={() => router.replace('/(driver)/code-validation')} height={52} style={{ marginTop: 14 }} />
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={12} color={AU.faint} />
          <Text style={styles.lockText}>Colis à bord · annulation impossible</Text>
        </View>
      </View>
    </View>
  );
}

function RoundAction({ icon, label, onPress, badge }: { icon: any; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
      <View style={styles.roundIcon}>
        <Ionicons name={icon} size={20} color={AU.kola} />
        {badge ? (
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#16140F', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  stepChip: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, shadowColor: '#16140F', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  stepChipText: { fontFamily: AF.mono, fontSize: 11, letterSpacing: 1.5, color: AU.muted },

  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    backgroundColor: '#DCEFE1',
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#0E3A28',
    shadowOpacity: 0.2,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  eyebrow: { fontFamily: AF.mono, fontSize: 10, letterSpacing: 2, color: AU.kola },
  name: { fontFamily: AF.disp, fontSize: 25, letterSpacing: -0.8, color: AU.ink, marginTop: 5 },
  details: { fontFamily: AF.med, fontSize: 13.5, color: AU.muted, marginTop: 3 },

  progWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  progTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: 'rgba(14,58,40,0.12)', overflow: 'hidden' },
  progFill: { height: 7, borderRadius: 4, backgroundColor: AU.teal },
  progPct: { fontFamily: AF.mono, fontSize: 11, letterSpacing: 0.5, color: AU.kola },

  statRow: { flexDirection: 'row', marginTop: 14 },
  statK: { fontFamily: AF.mono, fontSize: 9, letterSpacing: 1.6, color: AU.muted },
  statV: { fontFamily: AF.disp, fontSize: 26, letterSpacing: -0.8, color: AU.ink, marginTop: 3 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  round: { flex: 1, alignItems: 'center', gap: 6 },
  roundIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  roundBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: AU.danger, alignItems: 'center', justifyContent: 'center' },
  roundBadgeText: { color: '#fff', fontFamily: AF.bold, fontSize: 10 },
  roundLabel: { fontFamily: AF.semi, fontSize: 12, color: AU.ink2 },

  lockRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lockText: { color: AU.faint, fontFamily: AF.semi, fontSize: 12.5 },
});
