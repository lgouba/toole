import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';
import { ActivityItem, Transaction, TX_TYPE_LABEL } from '@/services/wallet.service';

// Couleurs (maquette Portefeuille). Vert = gain, bleu = versement/reversement,
// ambre = commission à reverser, neutre = le reste.
const C = {
  green: '#15833F',
  greenTile: '#E7F5EC',
  blue: '#2457B4',
  blueTile: '#E6EDFB',
  amberFg: '#A96C12',
  amberTile: '#FBF1DE',
  amberDot: '#C4841F',
  neutralFg: '#8A8477',
  neutralTile: '#F2EFE7',
  textPrim: '#1A211C',
  textMuted: '#8A8477',
};

// --- Dates : format court, heure en 24h, année masquée si année courante. ---
function isSameYear(d: Date): boolean {
  return d.getFullYear() === new Date().getFullYear();
}
function dateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(isSameYear(d) ? {} : { year: 'numeric' }),
  });
}
function dateTimeShort(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateShort(iso)} · ${time}`;
}

/**
 * Une ligne du fil d'activité (course regroupée, ou transaction simple).
 * `variant='commission'` : vue « compte commission » — la course affiche la
 * commission DUE (ambre) au lieu du gain, sans pastille.
 */
export function ActivityRow({
  item,
  variant = 'default',
}: {
  item: ActivityItem;
  variant?: 'default' | 'commission';
}) {
  // ── Course (cash ou wallet) : une seule ligne ──
  if (item.kind === 'course') {
    if (variant === 'commission') {
      return (
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: C.amberTile }]}>
            <MaterialIcons name="payments" size={18} color={C.amberFg} />
          </View>
          <View style={styles.mid}>
            <Text style={styles.label} numberOfLines={1}>
              Commission course cash
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.reference ? `${item.reference} · ` : ''}
              {dateShort(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.amount, { color: C.amberFg }]} numberOfLines={1}>
            {formatCFA(item.commission)}
          </Text>
        </View>
      );
    }
    const showPastille = item.isCash && item.commission > 0;
    return (
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: C.greenTile }]}>
          <MaterialIcons name="two-wheeler" size={18} color={C.green} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.label} numberOfLines={1}>
            {item.isCash ? 'Course payée en cash' : 'Course versée au wallet'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.reference ? `${item.reference} · ` : ''}
            {dateShort(item.createdAt)}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amount, { color: C.green }]} numberOfLines={1}>
            +{formatCFA(item.gain)}
          </Text>
          {showPastille ? (
            <View style={[styles.pill, { backgroundColor: C.amberTile }]}>
              <View style={[styles.pillDot, { backgroundColor: C.amberDot }]} />
              <Text style={[styles.pillText, { color: C.amberFg }]} numberOfLines={1}>
                {formatCFA(item.commission)} à reverser
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Transaction simple (versement reçu / reversement commission / autres) ──
  const tx = item.tx;
  const pending = tx.status === 'pending';

  let title = TX_TYPE_LABEL[tx.type];
  let icon: keyof typeof MaterialIcons.glyphMap = 'swap-horiz';
  let fg = C.neutralFg;
  let tile = C.neutralTile;
  if (tx.type === 'withdrawal') {
    title = 'Versement reçu';
    icon = 'south-west';
    fg = C.blue;
    tile = C.blueTile;
  } else if (tx.type === 'topup') {
    title = 'Reversement commission';
    icon = 'north-east';
    fg = C.blue;
    tile = C.blueTile;
  } else if (tx.type === 'commission_debt') {
    // Commission à reverser sans course jumelle (cas rare : régularisation).
    title = 'Commission à reverser';
    icon = 'account-balance';
    fg = C.amberFg;
    tile = C.amberTile;
  } else if (tx.type === 'commission' || tx.type === 'tip') {
    title = tx.type === 'tip' ? 'Pourboire' : 'Gain livraison';
    icon = 'two-wheeler';
    fg = C.green;
    tile = C.greenTile;
  }

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: tile }]}>
        <MaterialIcons name={icon} size={18} color={fg} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.label} numberOfLines={1}>
          {title}
          {pending ? ' · en attente' : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {tx.delivery?.reference ? `${tx.delivery.reference} · ` : ''}
          {dateTimeShort(tx.createdAt)}
        </Text>
      </View>
      <Text style={[styles.amount, { color: fg }]} numberOfLines={1}>
        {formatCFA(Math.abs(tx.amount))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECE7DA',
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: R.font.bodyBold,
    fontSize: 14.5,
    color: C.textPrim,
    letterSpacing: -0.1,
  },
  meta: { fontFamily: R.font.mono, fontSize: 11.5, color: C.textMuted, marginTop: 2 },
  amountCol: { alignItems: 'flex-end', flexShrink: 0 },
  amount: { fontFamily: R.font.displayXBold, fontSize: 15, letterSpacing: -0.15, flexShrink: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontFamily: R.font.bodyBold, fontSize: 11 },
});
