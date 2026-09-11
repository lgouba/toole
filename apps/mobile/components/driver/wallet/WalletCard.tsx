import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { recap as R } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

/**
 * Carte Toolé (héros) : porte les TROIS chiffres calculés par le serveur —
 * disponible à retirer, gains cumulés, commission à reverser. Aucun calcul ici.
 */
export function WalletCard({
  balance,
  totalEarned,
  debt,
}: {
  balance: number;
  totalEarned: number;
  debt: number;
}) {
  return (
    <View style={styles.card}>
      {/* Dégradé 147° + cercle décoratif */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="wc" x1="0.12" y1="0" x2="0.88" y2="1">
            <Stop offset="0%" stopColor="#1FA65A" />
            <Stop offset="48%" stopColor="#12803E" />
            <Stop offset="100%" stopColor="#0A5227" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={20} fill="url(#wc)" />
        <Circle cx="100%" cy="0%" r="90" fill="#FFFFFF" opacity={0.09} />
      </Svg>

      <View style={styles.topRow}>
        <Text style={styles.wordmark}>Toolé</Text>
        <View style={styles.driverTag}>
          <MaterialCommunityIcons name="motorbike" size={13} color="#FFFFFF" />
          <Text style={styles.driverTagText}>DRIVER WALLET</Text>
        </View>
      </View>

      <Text style={styles.label}>DISPONIBLE À RETIRER</Text>
      <Text style={styles.balance}>
        {formatCFA(balance).replace(' FCFA', '')}
        <Text style={styles.currency}> FCFA</Text>
      </Text>

      <View style={styles.sep} />

      <View style={styles.cols}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Gains cumulés</Text>
          <Text style={styles.colValue}>{formatCFA(totalEarned)}</Text>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.col}>
          <Text style={styles.colLabel}>À reverser</Text>
          <Text style={[styles.colValue, styles.colValueDebt]}>{formatCFA(debt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#0A5227', // base pleine (le dégradé passe par-dessus)
    overflow: 'hidden',
    shadowColor: '#0E5E2A',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: R.font.displayXBold, fontSize: 16, color: '#FFFFFF' },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  driverTagText: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 0.9,
    color: '#FFFFFF',
  },
  label: {
    fontFamily: R.font.mono,
    fontSize: 10.5,
    letterSpacing: 1.15,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 12,
  },
  balance: { fontFamily: R.font.displayXBold, fontSize: 34, color: '#FFFFFF', marginTop: 2 },
  currency: { fontFamily: R.font.bodyBold, fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 13,
  },
  cols: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  col: { flex: 1 },
  colDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: 14,
  },
  colLabel: {
    fontFamily: R.font.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.65)',
  },
  colValue: {
    fontFamily: R.font.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
    marginTop: 3,
  },
  colValueDebt: { color: '#FFE2A8' },
});
