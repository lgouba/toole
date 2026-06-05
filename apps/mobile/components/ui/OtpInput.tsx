import React, { useRef, useState } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, borderRadius, spacing } from '@/theme';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
}

export function OtpInput({ length = 6, value, onChange, onComplete }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) {
      onComplete?.(cleaned);
    }
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.container}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.cell,
            i < value.length && styles.cellFilled,
            i === value.length && styles.cellActive,
          ]}
        >
          <Text style={styles.cellText}>{value[i] || ''}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        autoFocus
        // Auto-remplissage du code OTP reçu par SMS :
        //  - iOS lit le code dans le SMS et le propose au-dessus du clavier
        //    (textContentType="oneTimeCode").
        //  - Android le propose via le framework d'autofill (autoComplete="sms-otp").
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cell: {
    width: 48,
    height: 56,
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
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});
