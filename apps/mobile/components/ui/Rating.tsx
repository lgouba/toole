import React from 'react';
import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '@/theme';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readonly?: boolean;
}

/** Simple read-only rendering (for profile / lists). */
export function Rating({ value, onChange, size = 28, readonly = false }: RatingProps) {
  if (readonly) {
    return (
      <View style={styles.staticRow}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= value;
          const half = !filled && star - 0.5 <= value;
          const iconName = filled ? 'star' : half ? 'star-half' : 'star-outline';
          return (
            <Ionicons
              key={star}
              name={iconName}
              size={size}
              color={colors.warning}
              style={{ marginRight: 4 }}
            />
          );
        })}
      </View>
    );
  }
  return <InteractiveRating value={value} onChange={onChange} size={size} />;
}

/** --------- Interactive (for rating submission) --------- */

const REACTIONS: {
  score: number;
  emoji: string;
  label: string;
  color: string;
  bg: string;
}[] = [
  { score: 1, emoji: '😡', label: 'Terrible', color: '#dc2626', bg: '#fee2e2' },
  { score: 2, emoji: '😕', label: 'Decevant', color: '#ea580c', bg: '#ffedd5' },
  { score: 3, emoji: '😐', label: 'Correct', color: '#ca8a04', bg: '#fef3c7' },
  { score: 4, emoji: '😊', label: 'Tres bien', color: '#65a30d', bg: '#ecfccb' },
  { score: 5, emoji: '🤩', label: 'Excellent !', color: '#16a34a', bg: '#dcfce7' },
];

function InteractiveRating({
  value,
  onChange,
  size = 44,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  const reaction = value > 0 ? REACTIONS[value - 1] : null;

  return (
    <View style={styles.interactiveWrap}>
      {/* Emoji bubble (apparait quand note choisie) */}
      {reaction ? (
        <EmojiBubble
          key={reaction.score}
          emoji={reaction.emoji}
          label={reaction.label}
          color={reaction.color}
          bg={reaction.bg}
        />
      ) : (
        <View style={styles.emojiPlaceholder}>
          <Text style={styles.tapHint}>Appuyez sur une etoile</Text>
        </View>
      )}

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            index={star}
            active={star <= value}
            size={size}
            onPress={() => {
              if (Platform.OS !== 'web') {
                const style =
                  star <= 2
                    ? Haptics.NotificationFeedbackType.Warning
                    : star === 3
                      ? Haptics.NotificationFeedbackType.Success
                      : Haptics.NotificationFeedbackType.Success;
                Haptics.notificationAsync(style).catch(() => {});
              }
              onChange?.(star);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Star({
  index,
  active,
  size,
  onPress,
}: {
  index: number;
  active: boolean;
  size: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Petit rebond spring au tap
    scale.value = withSequence(
      withTiming(0.75, { duration: 80, easing: Easing.out(Easing.quad) }),
      withSpring(1.2, { damping: 6, stiffness: 160 }),
      withSpring(1, { damping: 10, stiffness: 140 }),
    );
    onPress();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={6}>
      <Animated.View style={[animatedStyle, { padding: 4 }]}>
        <Ionicons
          name={active ? 'star' : 'star-outline'}
          size={size}
          color={active ? colors.warning : '#d1d5db'}
        />
      </Animated.View>
    </Pressable>
  );
}

function EmojiBubble({
  emoji,
  label,
  color,
  bg,
}: {
  emoji: string;
  label: string;
  color: string;
  bg: string;
}) {
  const scale = useSharedValue(0);
  const translateY = useSharedValue(10);
  const rotate = useSharedValue(-8);

  React.useEffect(() => {
    scale.value = 0;
    translateY.value = 12;
    rotate.value = -10;
    scale.value = withDelay(30, withSpring(1, { damping: 7, stiffness: 180 }));
    translateY.value = withSpring(0, { damping: 10, stiffness: 160 });
    rotate.value = withSequence(
      withTiming(8, { duration: 180 }),
      withTiming(-4, { duration: 160 }),
      withTiming(0, { duration: 120 }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.emojiBubble, { backgroundColor: bg }, animatedStyle]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.emojiLabel, { color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  interactiveWrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  emojiBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  emoji: {
    fontSize: 32,
  },
  emojiLabel: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  emojiPlaceholder: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
