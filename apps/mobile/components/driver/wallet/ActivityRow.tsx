import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
// date-fns (déjà utilisé partout) — toLocale*/Intl est peu fiable sur Hermes
// Android (options ignorées, heure tronquée).
function dateShort(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: fr });
}
/** Montant formaté sans le suffixe monnaie (pour les lignes de détail compactes). */
function noCur(n: number): string {
  return formatCFA(n).replace(/\s\S+$/, '');
}
function dateTimeShort(iso: string): string {
  return `${dateShort(iso)} · ${format(new Date(iso), 'HH:mm', { locale: fr })}`;
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
      const settled = item.settled;
      return (
        <View style={[styles.row, settled && styles.rowSettled]}>
          <View
            style={[styles.icon, { backgroundColor: settled ? C.neutralTile : C.amberTile }]}
          >
            <MaterialIcons
              name={settled ? 'check' : 'payments'}
              size={18}
              color={settled ? C.neutralFg : C.amberFg}
            />
          </View>
          <View style={styles.mid}>
            <Text style={styles.label} numberOfLines={1}>
              Commission course cash
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.reference ? `${item.reference} · ` : ''}
              {dateShort(item.createdAt)}
              {settled ? ' · reversé' : ''}
            </Text>
          </View>
          <Text
            style={[
              styles.amount,
              { color: settled ? C.neutralFg : C.amberFg },
              settled && styles.amountStrike,
            ]}
            numberOfLines={1}
          >
            {formatCFA(item.commission)}
          </Text>
        </View>
      );
    }
    // Cash : le client remet TOUT le prix en main. On met en avant l'encaissé
    // (part livreur + commission due = ce qui est physiquement reçu), puis on
    // détaille « ta part » et « à reverser » pour lever toute ambiguïté.
    if (item.isCash) {
      const encaisse = item.gain + item.commission; // = prix payé cash par le client
      const hasDebt = item.commission > 0;
      return (
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: C.greenTile }]}>
            <MaterialIcons name="two-wheeler" size={18} color={C.green} />
          </View>
          <View style={styles.mid}>
            <View style={styles.line1}>
              <View style={styles.titleWrap}>
                <Text style={styles.label} numberOfLines={1}>
                  Course payée en cash
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.reference ? `${item.reference} · ` : ''}
                  {dateShort(item.createdAt)}
                </Text>
              </View>
              <View style={styles.amountCol}>
                <Text style={[styles.amount, { color: C.textPrim }]} numberOfLines={1}>
                  {formatCFA(encaisse)}
                </Text>
                <Text style={styles.amountTag} numberOfLines={1}>
                  encaissé
                </Text>
              </View>
            </View>
            <View style={styles.breakdown}>
              <Text style={styles.bkPart} numberOfLines={1}>
                Ta part <Text style={styles.bkPartVal}>{noCur(item.gain)}</Text>
              </Text>
              {hasDebt ? (
                <>
                  <Text style={styles.bkSep}>·</Text>
                  <View style={styles.bkDebt}>
                    <View style={[styles.pillDot, { backgroundColor: C.amberDot }]} />
                    <Text style={styles.bkDebtVal} numberOfLines={1}>
                      {noCur(item.commission)} à reverser
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    // Wallet / mobile money : le gain est réellement crédité sur le solde.
    return (
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: C.greenTile }]}>
          <MaterialIcons name="two-wheeler" size={18} color={C.green} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.label} numberOfLines={1}>
            Course versée au wallet
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.reference ? `${item.reference} · ` : ''}
            {dateShort(item.createdAt)}
          </Text>
        </View>
        <Text style={[styles.amount, { color: C.green }]} numberOfLines={1}>
          +{formatCFA(item.gain)}
        </Text>
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
  amountCol: { alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 },
  amount: { fontFamily: R.font.displayXBold, fontSize: 15, letterSpacing: -0.15, flexShrink: 0 },
  // Ligne cash : titre+réf à gauche, encaissé à droite, puis détail dessous.
  line1: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleWrap: { flex: 1, minWidth: 0 },
  amountTag: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: C.textMuted,
    marginTop: 1,
  },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, flexWrap: 'wrap' },
  bkPart: { fontFamily: R.font.body, fontSize: 12, color: C.textMuted },
  bkPartVal: { fontFamily: R.font.bodyBold, color: C.green },
  bkSep: { fontFamily: R.font.body, fontSize: 12, color: C.textMuted },
  bkDebt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: C.amberTile,
  },
  bkDebtVal: { fontFamily: R.font.bodyBold, fontSize: 11, color: C.amberFg },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  rowSettled: { opacity: 0.5 },
  amountStrike: { textDecorationLine: 'line-through' },
});
