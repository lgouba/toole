import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { recap as R, deliveries as D, ShipmentBucket } from '@/theme/recapTokens';

export type DeliveryFilterValue = 'all' | ShipmentBucket;

const FILTERS: { value: DeliveryFilterValue; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livree', label: 'Terminées' },
  { value: 'annulee', label: 'Annulées' },
];

/** Pills à largeurs égales (flex:1) — jamais tronquées, pas de scroll horizontal. */
export function DeliveryFilters({
  value,
  onChange,
}: {
  value: DeliveryFilterValue;
  onChange: (v: DeliveryFilterValue) => void;
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
    borderRadius: D.radius.pill,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipActive: { backgroundColor: D.green, borderColor: D.green },
  text: { fontFamily: R.font.bodyBold, fontSize: 12, color: D.textSec },
  textActive: { color: '#FFFFFF' },
});
