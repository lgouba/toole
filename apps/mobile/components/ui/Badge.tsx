import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '@/theme';
import { DeliveryStatus } from '@/types';

const statusConfig: Record<DeliveryStatus, { bg: string; text: string; label: string }> = {
  scheduled: { bg: '#E8F0FE', text: '#1967D2', label: 'Programmee' },
  pending: { bg: colors.warningLight, text: '#B07A1A', label: 'En attente' },
  accepted: { bg: colors.primaryLight, text: colors.primaryDark, label: 'Acceptee' },
  picking_up: { bg: '#E8F0FE', text: '#1967D2', label: 'Recuperation' },
  picked_up: { bg: '#E8F0FE', text: '#1967D2', label: 'Recupere' },
  delivering: { bg: colors.secondaryLight, text: colors.secondary, label: 'En livraison' },
  delivered: { bg: colors.successLight, text: colors.primaryDark, label: 'Livree' },
  cancelled: { bg: colors.errorLight, text: colors.error, label: 'Annulee' },
  expired: { bg: colors.surface, text: colors.textSecondary, label: 'Expiree' },
};

interface BadgeProps {
  status: DeliveryStatus;
  style?: ViewStyle;
}

export function Badge({ status, style }: BadgeProps) {
  const config = statusConfig[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  } as TextStyle,
});
