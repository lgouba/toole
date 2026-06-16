import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

/** Carte Toolé (héros) : solde disponible à retirer + total gagné. */
export function WalletCard({ balance, totalEarned }: { balance: number; totalEarned: number }) {
  return (
    <View style={styles.card}>
      {/* Dégradé + cercles décoratifs */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="wc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={W.cardGradFrom} />
            <Stop offset="100%" stopColor={W.cardGradTo} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={W.radius.card} fill="url(#wc)" />
        <Circle cx="88%" cy="8%" r="60" fill="#FFFFFF" opacity={0.07} />
        <Circle cx="72%" cy="95%" r="90" fill="#FFFFFF" opacity={0.05} />
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
      <Text style={styles.total}>Total gagné · {formatCFA(totalEarned)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: W.radius.card,
    padding: R.space.pad,
    // Fond vert plein en base (le dégradé SVG passe par-dessus) → garantit que
    // tout le contenu reste sur du vert, même si la hauteur grandit.
    backgroundColor: W.cardGradTo,
    overflow: 'hidden',
    shadowColor: '#0E5E2A',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: R.font.displayXBold, fontSize: 22, color: '#FFFFFF' },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  driverTagText: { fontFamily: R.font.mono, fontSize: 9, letterSpacing: 1, color: '#FFFFFF' },
  label: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.8)',
    marginTop: R.space.lg,
  },
  balance: { fontFamily: R.font.displayXBold, fontSize: 36, color: '#FFFFFF', marginTop: 2 },
  currency: { fontFamily: R.font.bodyBold, fontSize: 18, color: 'rgba(255,255,255,0.85)' },
  total: { fontFamily: R.font.mono, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
});
