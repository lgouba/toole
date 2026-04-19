import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { formatCFA } from '@/utils/format';

interface StatsCardProps {
  deliveriesToday: number;
  earningsToday: number;
  ratingAvg: number;
}

export function StatsCard({ deliveriesToday, earningsToday, ratingAvg }: StatsCardProps) {
  const safeRating = Number(ratingAvg);
  return (
    <Card>
      <Text style={styles.title}>Aujourd'hui</Text>
      <View style={styles.row}>
        <StatItem
          icon="bicycle"
          iconColor={colors.primary}
          label="Courses"
          value={String(deliveriesToday ?? 0)}
        />
        <StatItem
          icon="cash"
          iconColor={colors.success}
          label="Gains"
          value={formatCFA(Number(earningsToday) || 0)}
        />
        <StatItem
          icon="star"
          iconColor={colors.warning}
          label="Note"
          value={Number.isFinite(safeRating) ? safeRating.toFixed(1) : '—'}
        />
      </View>
    </Card>
  );
}

function StatItem({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon as any} size={22} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
