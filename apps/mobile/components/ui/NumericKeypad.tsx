import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

interface NumericKeypadProps {
  length?: number;
  onComplete: (code: string) => void;
}

export function NumericKeypad({ length = 4, onComplete }: NumericKeypadProps) {
  const [code, setCode] = useState('');

  const handlePress = (digit: string) => {
    if (code.length >= length) return;
    const newCode = code + digit;
    setCode(newCode);
    if (newCode.length === length) {
      onComplete(newCode);
      // Reset after a short delay to allow UI feedback
      setTimeout(() => setCode(''), 500);
    }
  };

  const handleDelete = () => {
    setCode((prev) => prev.slice(0, -1));
  };

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete'],
  ];

  return (
    <View style={styles.container}>
      {/* Code display */}
      <View style={styles.codeDisplay}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.dot, i < code.length && styles.dotFilled]} />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => {
              if (key === '') {
                return <View key="empty" style={styles.key} />;
              }
              if (key === 'delete') {
                return (
                  <TouchableOpacity
                    key="delete"
                    style={styles.key}
                    onPress={handleDelete}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="backspace-outline" size={28} color={colors.textPrimary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.key}
                  onPress={() => handlePress(key)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  codeDisplay: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  keypad: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  key: {
    width: 80,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
});
