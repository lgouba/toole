import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { CountryPicker, Country } from './CountryPicker';
import { authColors as C, authFonts as F, authRadius as R } from '@/theme/auth';

/** Formate des chiffres bruts par groupes de 2 : "70123456" -> "70 12 34 56". */
export function formatPhoneDigits(raw: string): string {
  return raw
    .replace(/\D/g, '')
    .replace(/(\d{2})(?=\d)/g, '$1 ')
    .trim();
}

export function PhoneField({
  country,
  onCountryChange,
  digits,
  onDigitsChange,
  maxDigits = 8,
  autoFocus = false,
}: {
  country: Country;
  onCountryChange: (c: Country) => void;
  digits: string;
  onDigitsChange: (d: string) => void;
  maxDigits?: number;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <CountryPicker value={country} onChange={onCountryChange} />
      <View style={styles.divider} />
      <TextInput
        style={styles.input}
        placeholder="70 12 34 56"
        placeholderTextColor={C.muted + '80'}
        keyboardType="number-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={formatPhoneDigits(digits)}
        onChangeText={(t) => onDigitsChange(t.replace(/\D/g, '').slice(0, maxDigits))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={maxDigits + Math.floor(maxDigits / 2)}
        autoFocus={autoFocus}
        accessibilityLabel="Numéro de téléphone"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: R.field,
    backgroundColor: '#fff',
  },
  wrapFocused: {
    borderColor: C.primary,
  },
  divider: {
    width: 1.5,
    height: 28,
    backgroundColor: C.line,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: F.bodyBold,
    fontSize: 17,
    letterSpacing: 1,
    color: C.text,
  },
});
