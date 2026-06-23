import React, { useRef } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, borderRadius, spacing } from '@/theme';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /**
   * Variante visuelle. 'default' = cases terra cotta (auth OTP). 'driver' =
   * cases vertes plus grandes + chiffres Space Grotesk (parcours livreur,
   * modèle C). Optionnel → rétro-compatible.
   */
  variant?: 'default' | 'driver';
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  variant = 'default',
}: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const driver = variant === 'driver';

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) {
      onComplete?.(cleaned);
    }
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.container}>
      {/* Cases visuelles (affichage seul) */}
      <View style={styles.cells} pointerEvents="none">
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              driver && styles.cellDriver,
              i < value.length && (driver ? styles.cellFilledDriver : styles.cellFilled),
              i === value.length && (driver ? styles.cellActiveDriver : styles.cellActive),
            ]}
          >
            <Text style={[styles.cellText, driver && styles.cellTextDriver]}>
              {value[i] || ''}
            </Text>
          </View>
        ))}
      </View>

      {/*
        Champ réel superposé EN PLEIN FORMAT (texte transparent, curseur masqué).
        Crucial pour l'auto-remplissage : iOS/Android n'attachent la suggestion
        du code OTP qu'à un champ visible et de taille non nulle. Un input 0×0
        empêche l'apparition de la suggestion au-dessus du clavier.
      */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.overlayInput}
        autoFocus
        caretHidden
        // iOS : lit le code dans le SMS reçu (textContentType="oneTimeCode").
        // Android : propose le code via l'autofill (autoComplete="sms-otp").
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
      />
    </Pressable>
  );
}

const CELL_W = 48;
const CELL_H = 56;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  cellFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  cellActive: {
    borderColor: colors.primary,
  },
  cellText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  // --- Variante livreur (modèle C) : vert + cases plus grandes + Bricolage ---
  cellDriver: {
    width: 58,
    height: 68,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ECE8DF',
  },
  cellFilledDriver: {
    borderColor: '#15803D',
    backgroundColor: '#fff',
  },
  cellActiveDriver: {
    borderColor: '#15803D',
    backgroundColor: '#fff',
  },
  cellTextDriver: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 26,
    color: '#16140F',
  },
  // Recouvre exactement la rangée de cases : focusable, mais invisible.
  overlayInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    fontSize: 1,
    textAlign: 'center',
  },
});
