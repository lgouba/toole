import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

/** Alerte ambre cliquable "À reverser à Toolé" → écran dédié. */
export function RemitAlert({ amount, onPress }: { amount: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={styles.icon}>
        <MaterialIcons name="priority-high" size={18} color={W.amberFg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>À reverser à Toolé</Text>
        <Text style={styles.sub}>Part cash · appuie pour régler</Text>
      </View>
      <Text style={styles.amount}>{formatCFA(amount)}</Text>
      <MaterialIcons name="chevron-right" size={22} color={W.amberFg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    backgroundColor: W.amberBg,
    borderWidth: 1,
    borderColor: W.amberBorder,
    borderRadius: W.radius.btn,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.md,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(224,162,28,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: R.font.bodyBold, fontSize: 14, color: W.amberFg },
  sub: { fontFamily: R.font.body, fontSize: 11.5, color: W.amberFg, opacity: 0.85, marginTop: 1 },
  amount: { fontFamily: R.font.displayXBold, fontSize: 15, color: W.amberFg },
});
