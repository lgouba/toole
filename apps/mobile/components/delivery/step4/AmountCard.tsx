import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R, step4 as S } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

interface Props {
  total: number;
  basePrice: number;
  distancePrice: number;
  distanceKm: number;
}

/** Carte montant à régler (issu du pricing, cohérent récap). */
export function AmountCard({ total, basePrice, distancePrice, distanceKm }: Props) {
  const km = `${distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
  return (
    <View style={styles.card}>
      <View style={styles.bar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>MONTANT À RÉGLER</Text>
        <Text style={styles.total}>{formatCFA(total)}</Text>
        <Text style={styles.detail}>
          Base {formatCFA(basePrice)} · Distance {km} {formatCFA(distancePrice)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    padding: R.space.gut,
    gap: R.space.lg,
    ...R.shadow.card,
  },
  bar: { width: 4, borderRadius: 2, backgroundColor: S.green },
  label: { fontFamily: R.font.mono, fontSize: 10, letterSpacing: 1.5, color: S.textMuted },
  total: { fontFamily: R.font.mono, fontSize: 28, lineHeight: 32, color: S.green, marginTop: 2 },
  detail: { fontFamily: R.font.mono, fontSize: 11.5, color: S.textMuted, marginTop: 4 },
});
