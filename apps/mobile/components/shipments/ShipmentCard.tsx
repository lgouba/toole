import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, shipments as S, shipmentStatus } from '@/theme/recapTokens';
import { Delivery, PackageSize } from '@/types';
import { formatCFA, formatEta } from '@/utils/format';
import { relativeTime, toBucket } from '@/utils/relativeTime';
import { RouteMini } from './RouteMini';

const SIZE_LABEL: Record<PackageSize, string> = {
  small: 'Petit colis',
  medium: 'Moyen colis',
  large: 'Grand colis',
};

interface Props {
  delivery: Delivery;
  onPress: () => void;
  onTrack: () => void;
}

export function ShipmentCard({ delivery, onPress, onTrack }: Props) {
  const bucket = toBucket(delivery.status);
  const meta = shipmentStatus[bucket];
  const isLive = bucket === 'en_cours';
  const category = delivery.packageSize ? SIZE_LABEL[delivery.packageSize] : 'Colis';
  const etaLabel = delivery.eta?.durationSeconds
    ? `En route · arrive dans ${formatEta(delivery.eta.durationSeconds)}`
    : 'En route';

  // Point "live" qui pulse (cartes en cours).
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (isLive) pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [isLive, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6, transform: [{ scale: 0.85 + pulse.value * 0.3 }] }));

  return (
    <TouchableOpacity
      style={[styles.card, isLive && styles.cardLive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.accent, { backgroundColor: meta.accent }]} />

      <View style={styles.body}>
        {/* Header : référence + badge */}
        <View style={styles.headerRow}>
          <Text style={styles.reference}>{delivery.reference}</Text>
          <View style={[styles.badge, { backgroundColor: meta.badgeBg }]}>
            {isLive ? (
              <Animated.View style={[styles.liveDot, dotStyle]} />
            ) : bucket === 'livree' ? (
              <MaterialIcons name="check-circle" size={12} color={meta.badgeFg} />
            ) : null}
            <Text style={[styles.badgeText, { color: meta.badgeFg }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={{ height: R.space.md }} />
        <RouteMini pickup={delivery.pickupAddress} dropoff={delivery.deliveryAddress} />

        {/* Ligne de suivi live */}
        {isLive && (
          <View style={styles.live}>
            <MaterialIcons name="two-wheeler" size={16} color={S.green} />
            <Text style={styles.liveText} numberOfLines={1}>{etaLabel}</Text>
            <TouchableOpacity onPress={onTrack} hitSlop={8}>
              <Text style={styles.trackLink}>Suivre</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        {/* Pied : catégorie · destinataire + prix */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <MaterialIcons name="inventory-2" size={15} color={S.textMuted} />
            <Text style={styles.footerText} numberOfLines={1}>
              {category} · {delivery.recipientName}
            </Text>
          </View>
          <Text style={styles.price}>{formatCFA(delivery.price)}</Text>
        </View>

        <Text style={styles.time}>{relativeTime(delivery.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    overflow: 'hidden',
    marginBottom: R.space.md,
  },
  cardLive: {
    borderColor: S.liveBorder,
    shadowColor: '#15803D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  accent: { width: 4 },
  body: { flex: 1, padding: R.space.gut },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reference: { fontFamily: R.font.mono, fontSize: 12, color: S.textMuted, letterSpacing: 0.3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: S.radius.badge,
  },
  badgeText: { fontFamily: R.font.bodyBold, fontSize: 11 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.sm,
    backgroundColor: S.liveBg,
    borderWidth: 1,
    borderColor: S.liveBorder,
    borderRadius: 12,
    paddingHorizontal: R.space.md,
    paddingVertical: R.space.sm,
    marginTop: R.space.md,
  },
  liveText: { flex: 1, fontFamily: R.font.body, fontSize: 12.5, color: S.green },
  trackLink: { fontFamily: R.font.bodyBold, fontSize: 12.5, color: S.green, textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: S.divider, marginVertical: R.space.md },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: R.space.sm },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  footerText: { fontFamily: R.font.body, fontSize: 13, color: S.textSec, flexShrink: 1 },
  price: { fontFamily: R.font.displayXBold, fontSize: 16, color: S.textPrim },
  time: { fontFamily: R.font.body, fontSize: 11.5, color: S.textMuted, marginTop: 6 },
});
