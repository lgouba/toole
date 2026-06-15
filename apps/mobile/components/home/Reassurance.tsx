import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, home as H } from '@/theme/recapTokens';

const ITEMS: { icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
  { icon: 'bolt', label: 'Rapide' },
  { icon: 'payments', label: 'Paiement à la livraison' },
  { icon: 'my-location', label: 'Suivi en temps réel' },
];

/** Bandeau de réassurance compact. */
export function Reassurance() {
  return (
    <View style={styles.row}>
      {ITEMS.map((it, i) => (
        <View key={i} style={styles.item}>
          <MaterialIcons name={it.icon} size={14} color={H.green} />
          <Text style={styles.label} numberOfLines={1}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: R.space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  label: { fontFamily: R.font.body, fontSize: 10.5, color: H.textSec },
});
