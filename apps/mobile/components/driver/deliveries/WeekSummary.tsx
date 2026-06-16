import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R, deliveries as D } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

/** Titre + résumé de la semaine (courses + gains). */
export function WeekSummary({ count, earnings }: { count: number; earnings: number }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Mes livraisons</Text>
      <Text style={styles.summary}>
        Cette semaine · {count} course{count > 1 ? 's' : ''} ·{' '}
        <Text style={styles.amount}>{formatCFA(earnings)}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: R.space.gut, paddingTop: R.space.sm, paddingBottom: R.space.md },
  title: { fontFamily: R.font.displayXBold, fontSize: 24, color: D.textPrim },
  summary: { fontFamily: R.font.body, fontSize: 13, color: D.textSec, marginTop: 3 },
  amount: { fontFamily: R.font.bodyBold, color: D.green },
});
