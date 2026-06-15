import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { recap as R } from '@/theme/recapTokens';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onApply: (code: string) => void;
  applied?: boolean;
}

/** Champ code promo (input dashed + bouton Appliquer ink). */
export function PromoField({ value, onChangeText, onApply, applied }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.inputBox, applied && styles.inputApplied]}>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.toUpperCase())}
          placeholder="CODE PROMO"
          placeholderTextColor={R.color.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
        {applied ? <Text style={styles.appliedTick}>✓</Text> : null}
      </View>
      <TouchableOpacity
        style={styles.applyBtn}
        onPress={() => onApply(value.trim())}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={styles.applyText}>Appliquer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: R.space.md, alignItems: 'stretch' },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: R.color.dashed,
    borderRadius: R.radius.field,
    paddingHorizontal: R.space.xl,
    height: 50,
    backgroundColor: R.color.surface,
  },
  inputApplied: { borderColor: R.color.green, borderStyle: 'solid' },
  input: {
    flex: 1,
    fontFamily: R.font.mono,
    fontSize: 13,
    letterSpacing: 1.2,
    color: R.color.textPrimary,
    padding: 0,
  },
  appliedTick: { fontFamily: R.font.mono, color: R.color.green, fontSize: 16 },
  applyBtn: {
    backgroundColor: R.color.ink,
    borderRadius: R.radius.field,
    paddingHorizontal: R.space.gut,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyText: { fontFamily: R.font.bodyBold, color: '#FFFFFF', fontSize: 14 },
});
