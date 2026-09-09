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
  // Désactivé (hors chargement) : couple lisible #E4DCCF / #6E7A72 au lieu d'un
  // simple opacity 0.5 (blanc sur vert pâle ~2:1, illisible). Les variantes
  // transparentes gardent leur fond, seul le texte est atténué.
  const showDisabled = disabled && !loading;
  const filled = variant === 'primary' || variant === 'secondary' || variant === 'danger';
  const disabledContainer =
    showDisabled && filled ? { backgroundColor: '#E4DCCF' } : undefined;
  const disabledText = showDisabled ? { color: '#6E7A72' } : undefined;

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
        disabledContainer,
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
              disabledText,
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
    // Plus d'opacity globale : le désactivé lisible est géré par le couple
    // #E4DCCF/#6E7A72 (cf. disabledContainer/disabledText). On retire juste le relief.
    shadowOpacity: 0,
    elevation: 0,
  },
});
