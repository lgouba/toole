import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { PriceEstimate as PriceEstimateType } from '@/types';
import { formatCFA, formatDistance } from '@/utils/format';

interface PriceEstimateProps {
  estimate: PriceEstimateType;
}

export function PriceEstimate({ estimate }: PriceEstimateProps) {
  return (
    <Card>
      <Text style={styles.title}>Estimation du prix</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Prix de base</Text>
        <Text style={styles.value}>{formatCFA(estimate.basePrice)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Distance ({formatDistance(estimate.distanceKm)})</Text>
        <Text style={styles.value}>{formatCFA(estimate.distancePrice)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCFA(estimate.price)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
  },
});
