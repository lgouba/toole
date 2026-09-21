import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, AccessibilityInfo, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CancelReasonDialog } from '@/components/CancelReasonDialog';
import { CancelCountdown } from '@/components/driver/flow/CancelCountdown';
import { Map } from '@/components/map/Map';
import { useDriverStore } from '@/stores/driver.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useMessageStore } from '@/stores/message.store';
import { openPhone, openNavigation } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { formatEta, formatDistance } from '@/utils/format';
import { LatLng } from '@/types';
import { AU, AF } from '@/theme/aurora';
import { AuroraGlow, GradientButton } from '@/components/aurora/AuroraBits';

export default function PickupNavigationScreen() {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const { activeDelivery, cancelActiveDelivery } = useDriverStore();
  const currentLocation = useDriverStore((s) => s.currentLocation);
  const cooldownSec = useSettingsStore((s) => s.settings.operations.driverCancelCooldownSeconds);
  const unread = useMessageStore((s) => s.unread[activeDelivery?.id ?? ''] ?? 0);
  const [showCancel, setShowCancel] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // ---------- LOGIQUE INCHANGÉE ----------
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

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
      const stale = ['cancelled', 'expired', 'pending'].includes(fresh.status);
      if (stale) {
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

  useEffect(() => {
    if (!activeDelivery?.acceptedAt) {
      setCooldownRemaining(0);
      return;
    }
    const update = () => {
      const acceptedAt = new Date(activeDelivery.acceptedAt!).getTime();
      const elapsed = (Date.now() - acceptedAt) / 1000;
      setCooldownRemaining(Math.max(0, Math.ceil(cooldownSec - elapsed)));
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

  // ---------- CARTE (affichage seulement, données existantes) ----------
  const d = activeDelivery;
  const markers = useMemo(() => {
    if (!d) return [];
    const list: any[] = [{ id: 'pickup', coordinate: d.pickupLocation, icon: 'pickup', label: d.pickupAddress }];
    if (currentLocation) list.push({ id: 'driver', coordinate: currentLocation, icon: 'driver', target: d.pickupLocation });
    return list;
  }, [d?.pickupLocation, currentLocation]);
  const routeCoords = useMemo<[LatLng, LatLng] | undefined>(
    () => (d && currentLocation ? [currentLocation, d.pickupLocation] : undefined),
    [d?.pickupLocation, currentLocation],
  );

  if (!d) return null;
  const center = currentLocation ?? d.pickupLocation;

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
          <Text style={styles.stepChipText}>ÉTAPE 1 / 4</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* panneau Aurora flottant */}
      <View style={styles.panel}>
        <AuroraGlow width={W - 24} height={360} opacity={1} style={{ position: 'absolute', top: -20, left: 0 }} />
        <Text style={styles.eyebrow}>RÉCUPÉRATION</Text>
        <Text numberOfLines={2} style={styles.address}>{d.pickupAddress}</Text>
        {d.pickupDetails ? <Text numberOfLines={1} style={styles.details}>{d.pickupDetails}</Text> : null}

        {d.eta ? (
          <View style={styles.statRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statK}>ARRIVÉE</Text>
              <Text style={styles.statV}>{formatEta(d.eta.durationSeconds)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statK}>DISTANCE</Text>
              <Text style={styles.statV}>{formatDistance(d.eta.distanceMeters / 1000)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <RoundAction icon="navigate" label="Itinéraire" onPress={() => openNavigation(d.pickupLocation.latitude, d.pickupLocation.longitude, d.pickupAddress)} />
          <RoundAction icon="call" label="Appeler" onPress={() => openPhone(d.senderContactPhone || d.senderPhone || d.recipientPhone)} />
          <RoundAction icon="chatbubble-ellipses" label="Message" badge={unread} onPress={() => router.push(`/chat/${d.id}?name=${encodeURIComponent(d.senderName ?? 'Client')}&reference=${encodeURIComponent(d.reference)}` as any)} />
        </View>

        <GradientButton label="Je suis arrivé" icon="checkmark" onPress={() => router.replace('/(driver)/pickup-confirm')} height={52} style={{ marginTop: 14 }} />

        {cooldownRemaining > 0 ? (
          <View style={{ marginTop: 10 }}>
            <CancelCountdown secondsLeft={cooldownRemaining} reduceMotion={reduceMotion} onPress={() => setShowCancel(true)} />
          </View>
        ) : (
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed" size={12} color={AU.faint} />
            <Text style={styles.lockText}>Délai d'annulation écoulé</Text>
          </View>
        )}
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
  eyebrow: { fontFamily: AF.mono, fontSize: 10, letterSpacing: 2, color: AU.kola },
  address: { fontFamily: AF.disp, fontSize: 23, lineHeight: 27, letterSpacing: -0.6, color: AU.ink, marginTop: 5 },
  details: { fontFamily: AF.med, fontSize: 13.5, color: AU.muted, marginTop: 4 },

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
