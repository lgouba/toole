import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { recap as R, step3 as S } from '@/theme/recapTokens';
import { formatNational, toNational } from '@/utils/phone';

interface Props {
  value: string; // valeur nationale stockée (8 chiffres)
  onChange: (national: string) => void;
}

/** Préfixe pays fixe 🇧🇫 +226 + champ numérique groupé "70 12 34 56". */
export function PhoneField({ value, onChange }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.row, focused && styles.rowFocus]}>
      <View style={styles.prefix}>
        <Text style={styles.flag}>🇧🇫</Text>
        <Text style={styles.code}>+226</Text>
      </View>
      <View style={styles.divider} />
      <TextInput
        value={formatNational(value)}
        onChangeText={(t) => onChange(toNational(t))}
        placeholder="70 12 34 56"
        placeholderTextColor={S.textMuted}
        keyboardType="phone-pad"
        style={styles.input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={11} // "70 12 34 56" = 11 caractères
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: S.radius.field,
    borderWidth: 1.5,
    borderColor: S.border,
    backgroundColor: S.fieldBg,
    paddingHorizontal: R.space.md,
  },
  rowFocus: { borderColor: S.fieldFocus, backgroundColor: '#FFFFFF' },
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: R.space.sm },
  flag: { fontSize: 18 },
  code: { fontFamily: R.font.mono, fontSize: 14, color: S.textPrim },
  divider: { width: 1, height: 24, backgroundColor: S.border, marginRight: R.space.md },
  input: { flex: 1, fontFamily: R.font.mono, fontSize: 15, color: S.textPrim, padding: 0, letterSpacing: 0.5 },
});
