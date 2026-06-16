import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { recap as R, shipments as S, ShipmentBucket } from '@/theme/recapTokens';

export type FilterValue = 'all' | ShipmentBucket;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livree', label: 'Livrées' },
  { value: 'annulee', label: 'Annulées' },
];

/**
 * Filtres en pills à largeurs ÉGALES (flex:1) → toujours sur une ligne,
 * jamais coupées, pas de scroll horizontal.
 */
export function StatusFilters({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  return (
    <View style={styles.row}>
      {FILTERS.map((f) => {
        const active = value === f.value;
        return (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(f.value)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: R.space.gut, marginBottom: R.space.md },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: S.radius.chip,
    backgroundColor: S.surface,
    borderWidth: 1,
    borderColor: S.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipActive: { backgroundColor: S.green, borderColor: S.green },
  text: { fontFamily: R.font.bodyBold, fontSize: 12, color: S.textSec },
  textActive: { color: '#FFFFFF' },
});
