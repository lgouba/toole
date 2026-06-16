import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, deliveries as D } from '@/theme/recapTokens';
import { Delivery, PackageSize } from '@/types';
import { formatCFA, formatEta, formatDistance } from '@/utils/format';
import { relativeTime, toBucket } from '@/utils/relativeTime';
import { courierEarning } from '@/utils/courierEarning';
import { RouteMini } from '@/components/shipments/RouteMini';

const SIZE_LABEL: Record<PackageSize, string> = {
  small: 'Petit colis',
  medium: 'Moyen colis',
  large: 'Grand colis',
};

interface Props {
  delivery: Delivery;
  onPress: () => void;
  onContinue: () => void;
}

export function DriverDeliveryCard({ delivery, onPress, onContinue }: Props) {
  const bucket = toBucket(delivery.status);
  const meta = D.status[bucket];
  const isLive = bucket === 'en_cours';
  const cancelled = bucket === 'annulee';
  const category = delivery.packageSize ? SIZE_LABEL[delivery.packageSize] : 'Colis';
  const earning = courierEarning(delivery);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (isLive) pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [isLive, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6, transform: [{ scale: 0.85 + pulse.value * 0.3 }] }));

  const liveLabel = delivery.eta?.durationSeconds
    ? `${delivery.status === 'picked_up' || delivery.status === 'delivering' ? 'Colis récupéré · en route' : 'En route'} · arrive dans ${formatEta(delivery.eta.durationSeconds)}`
    : 'Course en cours';

  const metaParts = [category, delivery.recipientName];
  if (delivery.estimatedDistanceKm) metaParts.push(formatDistance(delivery.estimatedDistanceKm));

  return (
    <TouchableOpacity style={[styles.card, isLive && styles.cardLive]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.accent, { backgroundColor: meta.accent }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.reference}>{delivery.reference}</Text>
          <View style={[styles.badge, { backgroundColor: meta.badgeBg }]}>
            {isLive ? <Animated.View style={[styles.liveDot, dotStyle]} /> : null}
            <Text style={[styles.badgeText, { color: meta.badgeFg }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={{ height: R.space.md }} />
        <RouteMini pickup={delivery.pickupAddress} dropoff={delivery.deliveryAddress} />

        {isLive && (
          <>
            <View style={styles.live}>
              <MaterialIcons name="two-wheeler" size={16} color={D.green} />
              <Text style={styles.liveText} numberOfLines={1}>{liveLabel}</Text>
            </View>
            <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.9}>
              <MaterialIcons name="navigation" size={18} color="#FFFFFF" />
              <Text style={styles.continueText}>Continuer la livraison</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <MaterialIcons name="inventory-2" size={15} color={D.textMuted} />
            <Text style={styles.footerText} numberOfLines={1}>{metaParts.join(' · ')}</Text>
          </View>
          {cancelled ? (
            <Text style={styles.earnEmpty}>—</Text>
          ) : (
            <Text style={styles.earn}>+{formatCFA(earning)}</Text>
          )}
        </View>

        <Text style={styles.time}>
          {relativeTime(delivery.createdAt)}
          {cancelled ? ' · annulée' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: D.surface,
    borderRadius: D.radius.card,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
    marginBottom: R.space.md,
  },
  cardLive: {
    borderColor: D.liveBorder,
    shadowColor: '#15803D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  accent: { width: 4 },
  body: { flex: 1, padding: R.space.gut },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reference: { fontFamily: R.font.mono, fontSize: 12, color: D.textMuted, letterSpacing: 0.3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: D.radius.pill },
  badgeText: { fontFamily: R.font.bodyBold, fontSize: 11 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: R.space.sm,
    backgroundColor: D.liveBg, borderWidth: 1, borderColor: D.liveBorder,
    borderRadius: 12, paddingHorizontal: R.space.md, paddingVertical: R.space.sm, marginTop: R.space.md,
  },
  liveText: { flex: 1, fontFamily: R.font.body, fontSize: 12.5, color: D.green },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: R.space.sm,
    backgroundColor: D.green, height: 46, borderRadius: D.radius.btn, marginTop: R.space.md,
  },
  continueText: { fontFamily: R.font.bodyBold, fontSize: 14, color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: D.divider, marginVertical: R.space.md },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: R.space.sm },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  footerText: { fontFamily: R.font.body, fontSize: 13, color: D.textSec, flexShrink: 1 },
  earn: { fontFamily: R.font.displayXBold, fontSize: 16, color: D.green },
  earnEmpty: { fontFamily: R.font.displayXBold, fontSize: 16, color: D.textMuted },
  time: { fontFamily: R.font.body, fontSize: 11.5, color: D.textMuted, marginTop: 6 },
});
