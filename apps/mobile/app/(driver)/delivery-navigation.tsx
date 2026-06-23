import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DriverHood } from '@/components/driver/flow/DriverHood';
import { DriverQuickBar } from '@/components/driver/flow/DriverQuickBar';
import { C, F } from '@/components/driver/flow/tokens';
import { useDriverStore } from '@/stores/driver.store';
import { useMessageStore } from '@/stores/message.store';
import { openPhone, openNavigation } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { formatEta, formatDistance } from '@/utils/format';

export default function DeliveryNavigationScreen() {
  const router = useRouter();
  const { activeDelivery } = useDriverStore();
  const unread = useMessageStore((s) => s.unread[activeDelivery?.id ?? ''] ?? 0);

  // Compteur de non-lus au montage (badge Message).
  useEffect(() => {
    if (activeDelivery?.id) useMessageStore.getState().loadUnread(activeDelivery.id);
  }, [activeDelivery?.id]);

  // Vérifie au mount + toutes les 10s que la livraison est toujours valide.
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

  if (!activeDelivery) return null;
  const d = activeDelivery;

  return (
    <View style={styles.container}>
      <DriverHood height={330} step={3} onBack={() => router.back()}>
        <Text style={styles.eyebrow}>✓ COLIS À BORD · LIVRAISON</Text>
        <Text style={styles.big} numberOfLines={1}>
          {d.recipientName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {d.deliveryAddress}
        </Text>
        {d.eta ? (
          <View style={styles.etaRow}>
            <View>
              <Text style={styles.etaK}>ARRIVÉE</Text>
              <Text style={styles.etaV}>{formatEta(d.eta.durationSeconds)}</Text>
            </View>
            <View>
              <Text style={styles.etaK}>DISTANCE</Text>
              <Text style={styles.etaV}>
                {formatDistance(d.eta.distanceMeters / 1000)}
              </Text>
            </View>
          </View>
        ) : null}
      </DriverHood>

      <View style={styles.quickWrap}>
        <DriverQuickBar
          unread={unread}
          onRoute={() =>
            openNavigation(
              d.deliveryLocation.latitude,
              d.deliveryLocation.longitude,
              d.deliveryAddress,
            )
          }
          onCall={() => openPhone(d.recipientPhone)}
          onMessage={() =>
            router.push(
              `/chat/${d.id}?name=${encodeURIComponent(
                d.senderName ?? 'Client',
              )}&reference=${encodeURIComponent(d.reference)}` as any,
            )
          }
        />
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.9}
          onPress={() => router.replace('/(driver)/code-validation')}
        >
          <Ionicons name="checkmark" size={22} color="#fff" />
          <Text style={styles.ctaText}>Je suis arrivé</Text>
        </TouchableOpacity>

        <View style={styles.locked}>
          <Ionicons name="lock-closed" size={14} color={C.muted} />
          <Text style={styles.lockedText}>Colis à bord · annulation impossible</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  eyebrow: { color: C.lime, fontFamily: F.uiBold, fontSize: 11, letterSpacing: 1.5 },
  big: {
    color: '#fff',
    fontFamily: F.display,
    fontSize: 28,
    lineHeight: 32,
    marginTop: 8,
  },
  sub: { color: 'rgba(255,255,255,0.7)', fontFamily: F.ui, fontSize: 13, marginTop: 6 },
  etaRow: { flexDirection: 'row', gap: 26, marginTop: 18 },
  etaK: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: F.uiBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  etaV: { color: '#fff', fontFamily: F.display, fontSize: 22, marginTop: 3 },

  quickWrap: { paddingHorizontal: 18, marginTop: -40, zIndex: 5 },

  footer: { paddingHorizontal: 20, paddingBottom: 14, paddingTop: 6 },
  cta: {
    backgroundColor: C.gDark,
    borderRadius: 18,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: C.gMid,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  ctaText: { color: '#fff', fontFamily: F.uiBold, fontSize: 16 },
  locked: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  lockedText: { color: C.muted, fontFamily: F.uiSemi, fontSize: 12.5 },
});
