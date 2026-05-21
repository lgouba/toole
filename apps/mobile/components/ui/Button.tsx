import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { typography, borderRadius, sizes, spacing, useColors, colors } from '@/theme';
import { haptic } from '@/utils/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'default' | 'small';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const colors = useColors();

  const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: colors.primary },
      text: { color: colors.white },
    },
    secondary: {
      container: { backgroundColor: colors.secondary },
      text: { color: colors.white },
    },
    outline: {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
      text: { color: colors.primary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.primary },
    },
    danger: {
      container: { backgroundColor: colors.error },
      text: { color: colors.white },
    },
  };

  const vs = variantStyles[variant];
  const isSmall = size === 'small';
  const isDisabled = disabled || loading;

  const handlePress = () => {
    haptic.light();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.container,
        vs.container,
        isSmall && styles.containerSmall,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vs.text.color as string} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              isSmall ? typography.buttonSmall : typography.button,
              vs.text,
              icon ? { marginLeft: spacing.sm } : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: sizes.buttonHeight,
    // Design "Friendly & Local" : coins tres arrondis pour CTA accueillants.
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    // Ombre douce pour donner du relief au CTA principal.
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  containerSmall: {
    height: sizes.buttonHeightSmall,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
});
