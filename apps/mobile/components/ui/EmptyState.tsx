import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Button } from './Button';
import { colors, typography, spacing } from '@/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tonalite de l'illustration. Defaut: primary (vert Tolle). */
  tone?: 'primary' | 'secondary' | 'neutral' | 'warning';
  /** Active la mini-animation flottement de l'icone. Defaut: true. */
  animated?: boolean;
}

const TONE_MAP = {
  primary: { color: colors.primary, light: colors.primaryLight },
  secondary: { color: colors.secondary, light: colors.secondaryLight ?? '#fde6dc' },
  neutral: { color: colors.textTertiary, light: colors.surface },
  warning: { color: colors.warning, light: colors.warningLight ?? '#fff4d9' },
} as const;

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
  tone = 'primary',
  animated = true,
}: EmptyStateProps) {
  const toneColors = TONE_MAP[tone];

  // Mini-animation : leger flottement vertical pour donner vie a l'écran
  const float = useSharedValue(0);
  useEffect(() => {
    if (!animated) return;
    float.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconBg,
          { backgroundColor: toneColors.light },
          animatedStyle,
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: toneColors.color }]}>
          <Ionicons name={icon} size={40} color={colors.white} />
        </View>
        {/* Petits "confettis" decoratifs autour de l'icone */}
        <View
          style={[
            styles.deco,
            { backgroundColor: toneColors.color, top: 8, left: 12, opacity: 0.4 },
          ]}
        />
        <View
          style={[
            styles.deco,
            {
              backgroundColor: toneColors.color,
              bottom: 14,
              right: 16,
              opacity: 0.25,
              width: 10,
              height: 10,
              borderRadius: 5,
            },
          ]}
        />
        <View
          style={[
            styles.deco,
            {
              backgroundColor: toneColors.color,
              top: 30,
              right: 6,
              opacity: 0.5,
              width: 6,
              height: 6,
              borderRadius: 3,
            },
          ]}
        />
      </Animated.View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="small"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  iconBg: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  deco: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.lg,
    minWidth: 200,
  },
});
