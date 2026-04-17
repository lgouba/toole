import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { haptic } from '@/utils/haptics';

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: () => void;
}

export function OnlineToggle({ isOnline, onToggle }: OnlineToggleProps) {
  const handlePress = () => {
    haptic.medium();
    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[styles.container, isOnline ? styles.online : styles.offline]}
    >
      <View style={[styles.indicator, isOnline ? styles.indicatorOnline : styles.indicatorOffline]} />
      <View style={styles.content}>
        <Text style={[styles.status, isOnline ? styles.statusOnline : styles.statusOffline]}>
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </Text>
        <Text style={[styles.hint, isOnline ? styles.hintOnline : styles.hintOffline]}>
          {isOnline ? 'Vous recevez des demandes' : 'Appuyez pour recevoir des demandes'}
        </Text>
      </View>
      <Ionicons
        name={isOnline ? 'power' : 'power-outline'}
        size={28}
        color={isOnline ? colors.white : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  online: {
    backgroundColor: colors.primary,
  },
  offline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  indicatorOnline: {
    backgroundColor: '#4ADE80',
  },
  indicatorOffline: {
    backgroundColor: colors.textTertiary,
  },
  content: {
    flex: 1,
  },
  status: {
    ...typography.bodyMedium,
  },
  statusOnline: {
    color: colors.white,
  },
  statusOffline: {
    color: colors.textPrimary,
  },
  hint: {
    ...typography.caption,
  },
  hintOnline: {
    color: 'rgba(255,255,255,0.8)',
  },
  hintOffline: {
    color: colors.textSecondary,
  },
});
