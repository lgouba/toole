import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readonly?: boolean;
}

export function Rating({ value, onChange, size = 28, readonly = false }: RatingProps) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const half = !filled && star - 0.5 <= value;
        const iconName = filled ? 'star' : half ? 'star-half' : 'star-outline';

        const StarWrapper = readonly ? View : TouchableOpacity;

        return (
          <StarWrapper
            key={star}
            onPress={readonly ? undefined : (() => onChange?.(star)) as any}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={size}
              color={colors.warning}
            />
          </StarWrapper>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
