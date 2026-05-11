import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '@/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Composant skeleton (placeholder gris animé) pour afficher pendant
 * le chargement de données — donne une impression de progression au lieu
 * d'un écran blanc.
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius: radius },
        animated,
        style,
      ]}
    />
  );
}

/** Skeleton préfabriqué pour une ligne de livraison/transaction. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width={'70%'} height={14} />
        <Skeleton width={'50%'} height={12} />
        <Skeleton width={'30%'} height={11} />
      </View>
      <Skeleton width={70} height={16} radius={4} />
    </View>
  );
}

/** Skeleton préfabriqué pour une card carrée (driver card, etc.). */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Skeleton width={56} height={56} radius={28} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width={'60%'} height={14} />
          <Skeleton width={'40%'} height={12} />
        </View>
      </View>
      <Skeleton width={'100%'} height={12} style={{ marginTop: spacing.sm }} />
      <Skeleton width={'80%'} height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

/** Liste de N skeleton rows — pratique pour remplir une FlatList loading. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
