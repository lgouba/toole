import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import { formatCFA, formatDateTime } from '@/utils/format';
import {
  ActivityItem,
  Transaction,
  TX_TYPE_LABEL,
  txNature,
  TxNature,
} from '@/services/wallet.service';

// 3 natures = 3 styles distincts (fini le "tout vert / tout ambre") :
//   gain (vert), à reverser (ambre), versement/reversement (bleu).
const COL: Record<TxNature, { fg: string; bg: string }> = {
  gain: { fg: W.plus, bg: '#E7F2E9' },
  reverse: { fg: W.amberFg, bg: '#FBF3DC' },
  payout: { fg: '#2563EB', bg: '#E4EEFB' },
  remit: { fg: '#2563EB', bg: '#E4EEFB' },
  neutral: { fg: W.textMuted, bg: '#EFECE4' },
};

const ICON: Record<Transaction['type'], keyof typeof MaterialIcons.glyphMap> = {
  payment: 'payments',
  commission: 'two-wheeler',
  commission_debt: 'account-balance',
  tip: 'volunteer-activism',
  topup: 'north-east',
  withdrawal: 'south-west',
  withdrawal_fee: 'receipt-long',
  adjustment: 'tune',
};

/** Une ligne du fil d'activité (course cash regroupée, ou transaction simple). */
export function ActivityRow({ item }: { item: ActivityItem }) {
  // ── Course cash regroupée : gain (déjà en poche) + commission à reverser ──
  if (item.kind === 'course') {
    return (
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: COL.gain.bg }]}>
          <MaterialIcons name="two-wheeler" size={18} color={COL.gain.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label} numberOfLines={1}>
            Course {item.reference ?? ''}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            Payée en cash · {formatDateTime(item.createdAt)}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amount, { color: COL.gain.fg }]}>
            +{formatCFA(item.gain)}
          </Text>
          {item.commission > 0 ? (
            <Text style={[styles.subAmount, { color: W.amberFg }]}>
              {formatCFA(item.commission)} à reverser
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Transaction simple ──
  const tx = item.tx;
  const nature = txNature(tx.type);
  const col = COL[nature];
  const ref = tx.delivery?.reference;
  const pending = tx.status === 'pending';

  // Sens/préfixe selon la nature (pas de "−" trompeur sur un versement reçu).
  let prefix = '';
  let sub: string | null = null;
  if (nature === 'gain') {
    prefix = '+';
    sub = tx.type === 'commission' ? 'versé au portefeuille' : null;
  } else if (nature === 'reverse') {
    sub = 'à reverser';
  } else if (nature === 'payout') {
    sub = tx.type === 'withdrawal' ? 'reçu' : null;
  } else if (nature === 'remit') {
    sub = 'commission réglée';
  } else {
    prefix = tx.amount < 0 ? '−' : '';
  }

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: col.bg }]}>
        <MaterialIcons name={ICON[tx.type]} size={18} color={col.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>
          {TX_TYPE_LABEL[tx.type]}
          {pending ? ' · en attente' : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {ref ? `${ref} · ` : ''}
          {formatDateTime(tx.createdAt)}
        </Text>
      </View>
      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: col.fg }]}>
          {prefix}
          {formatCFA(Math.abs(tx.amount))}
        </Text>
        {sub ? (
          <Text
            style={[
              styles.subAmount,
              { color: nature === 'reverse' ? W.amberFg : W.textMuted },
            ]}
          >
            {sub}
          </Text>
        ) : null}
      </View>
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
  amountCol: { alignItems: 'flex-end' },
  amount: { fontFamily: R.font.displayXBold, fontSize: 14 },
  subAmount: {
    fontFamily: R.font.mono,
    fontSize: 10.5,
    color: W.textMuted,
    marginTop: 1,
  },
});
