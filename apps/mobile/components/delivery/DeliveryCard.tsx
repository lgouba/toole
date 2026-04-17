import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { Delivery, PACKAGE_LABELS } from '@/types';
import { formatCFA, formatRelativeTime } from '@/utils/format';

interface DeliveryCardProps {
  delivery: Delivery;
  onPress?: () => void;
}

export function DeliveryCard({ delivery, onPress }: DeliveryCardProps) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.reference}>{delivery.reference}</Text>
        <Badge status={delivery.status} />
      </View>

      <View style={styles.addresses}>
        <View style={styles.addressRow}>
          <Ionicons name="radio-button-on" size={14} color={colors.primary} />
          <Text style={styles.address} numberOfLines={1}>{delivery.pickupAddress}</Text>
        </View>
        <View style={styles.line} />
        <View style={styles.addressRow}>
          <Ionicons name="location" size={14} color={colors.secondary} />
          <Text style={styles.address} numberOfLines={1}>{delivery.deliveryAddress}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.packageType}>{PACKAGE_LABELS[delivery.packageType]}</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.recipient}>{delivery.recipientName}</Text>
        </View>
        <Text style={styles.price}>{formatCFA(delivery.price)}</Text>
      </View>

      <Text style={styles.time}>{formatRelativeTime(delivery.createdAt)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reference: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  addresses: {
    marginBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  line: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginLeft: 7,
    marginVertical: 2,
  },
  address: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageType: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dot: {
    color: colors.textTertiary,
  },
  recipient: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  price: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
