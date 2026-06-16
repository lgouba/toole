import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import { formatCFA, formatDateTime } from '@/utils/format';
import { Transaction, TX_TYPE_LABEL } from '@/services/wallet.service';

const ICON: Record<Transaction['type'], keyof typeof MaterialIcons.glyphMap> = {
  payment: 'payments',
  commission: 'two-wheeler',
  commission_debt: 'account-balance',
  tip: 'volunteer-activism',
  topup: 'south-west',
  withdrawal: 'north-east',
  withdrawal_fee: 'receipt-long',
  adjustment: 'tune',
};

/** Une ligne du fil d'activité : icône + libellé + réf·date + montant coloré. */
export function ActivityRow({ tx }: { tx: Transaction }) {
  // Crédit livreur (gain/pourboire) = +vert ; débits (retrait/reversement/commission) = −ambre.
  const isCredit = tx.type === 'commission' || tx.type === 'tip';
  const sign = isCredit ? '+' : '−';
  const color = isCredit ? W.plus : W.minus;
  const ref = tx.delivery?.reference;
  const pending = tx.status === 'pending';

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: isCredit ? '#E7F2E9' : '#FBF3DC' }]}>
        <MaterialIcons name={ICON[tx.type]} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>
          {TX_TYPE_LABEL[tx.type]}
          {pending ? ' · en attente' : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {ref ? `${ref} · ` : ''}{formatDateTime(tx.createdAt)}
        </Text>
      </View>
      <Text style={[styles.amount, { color }]}>
        {sign}{formatCFA(Math.abs(tx.amount))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    paddingVertical: R.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: W.divider,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: W.textPrim },
  meta: { fontFamily: R.font.mono, fontSize: 11, color: W.textMuted, marginTop: 2 },
  amount: { fontFamily: R.font.displayXBold, fontSize: 14 },
});
