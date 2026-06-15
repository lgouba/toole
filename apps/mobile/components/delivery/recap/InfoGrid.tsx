import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R } from '@/theme/recapTokens';

export interface InfoTile {
  label: string;
  value: string;
}

/** Grille 2 colonnes des infos colis (taille / catégorie / paiement / destinataire). */
export function InfoGrid({ items }: { items: InfoTile[] }) {
  return (
    <View style={styles.grid}>
      {items.map((it, i) => (
        <View key={i} style={styles.tile}>
          <Text style={styles.label}>{it.label}</Text>
          <Text style={styles.value} numberOfLines={2}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: R.space.md,
  },
  tile: {
    width: '48.5%',
    backgroundColor: R.color.surface,
    borderRadius: R.radius.tile,
    borderWidth: 1,
    borderColor: R.color.border,
    padding: R.space.xl,
    gap: 5,
  },
  label: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: R.color.textMuted,
  },
  value: {
    fontFamily: R.font.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: R.color.textPrimary,
  },
});
