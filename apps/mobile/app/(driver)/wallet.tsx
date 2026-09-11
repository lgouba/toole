import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SkeletonList } from '@/components/ui';
import { MOBILE_MONEY_ENABLED } from '@/config/features';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import {
  getMyWallet,
  getMyTransactions,
  buildActivityItems,
  WalletSnapshot,
  Transaction,
  ActivityItem,
} from '@/services/wallet.service';
import { formatCFA } from '@/utils/format';
import { WalletCard } from '@/components/driver/wallet/WalletCard';
import { RemitAlert } from '@/components/driver/wallet/RemitAlert';
import { ActivityRow } from '@/components/driver/wallet/ActivityRow';

type Tab = 'all' | 'courses' | 'reverse' | 'payouts';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'courses', label: 'Courses' },
  { key: 'reverse', label: 'À reverser' },
  { key: 'payouts', label: 'Versements' },
];

export default function WalletScreen() {
  const router = useRouter();
  const [snap, setSnap] = useState<WalletSnapshot | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  const load = async () => {
    try {
      const [w, t] = await Promise.all([getMyWallet(), getMyTransactions()]);
      setSnap(w);
      setTxs(t);
    } catch {
      /* silent */
    }
  };

  // Reset sur « Tout » à chaque retour sur l'écran + recharge.
  useFocusEffect(
    useCallback(() => {
      setTab('all');
      load().finally(() => setLoading(false));
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const balance = snap?.balance ?? 0;
  const totalEarned = snap?.totalEarned ?? 0;
  const debt = snap?.commissionDebt ?? 0;
  const canWithdraw = MOBILE_MONEY_ENABLED && balance > 0;

  // Regroupe les 2 lignes d'une course cash (gain + commission) en une entrée.
  const items = useMemo(() => buildActivityItems(txs), [txs]);

  // Filtrage 100 % client (aucun appel réseau au changement d'onglet).
  const visible = useMemo<ActivityItem[]>(() => {
    switch (tab) {
      case 'courses':
        return items.filter((it) => it.kind === 'course');
      case 'reverse':
        // Compte commission : uniquement les commissions dues (courses cash).
        return items.filter((it) => it.kind === 'course' && it.isCash && it.commission > 0);
      case 'payouts':
        return items.filter(
          (it) => it.kind === 'single' && (it.tx.type === 'withdrawal' || it.tx.type === 'topup'),
        );
      default:
        return items;
    }
  }, [items, tab]);

  const emptyText: Record<Tab, string> = {
    all: 'Tes gains, reversements et versements apparaîtront ici.',
    courses: 'Aucune course pour le moment.',
    reverse: 'Aucune commission à reverser.',
    payouts: 'Aucun versement pour le moment.',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(it) => (it.kind === 'course' ? `c-${it.id}` : it.tx.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={W.green} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Portefeuille</Text>

            <WalletCard balance={balance} totalEarned={totalEarned} debt={debt} />

            <TouchableOpacity
              style={[styles.withdraw, !canWithdraw && styles.withdrawOff]}
              disabled={!canWithdraw}
              onPress={() => router.push(`/wallet-flow?mode=withdraw&max=${balance}` as any)}
              activeOpacity={0.9}
            >
              <MaterialIcons name="account-balance-wallet" size={20} color="#FFFFFF" />
              <Text style={styles.withdrawText}>Retirer vers Mobile Money</Text>
            </TouchableOpacity>

            {!MOBILE_MONEY_ENABLED ? (
              <View style={styles.hint}>
                <MaterialIcons name="schedule" size={15} color={W.textMuted} />
                <Text style={styles.hintText}>Retrait et reversement bientôt disponibles.</Text>
              </View>
            ) : debt > 0 ? (
              // MM actif + dette : on garde l'accès au reversement (écran remit).
              <RemitAlert amount={debt} onPress={() => router.push('/(driver)/remit' as any)} />
            ) : null}

            <Text style={styles.activityTitle}>Activité</Text>

            <View style={styles.tabs}>
              {TABS.map((t) => {
                const active = t.key === tab;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setTab(t.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {tab === 'reverse' ? (
              <View style={styles.accountHead}>
                <Text style={styles.accountLabel}>COMPTE COMMISSION · À REVERSER</Text>
                <Text style={styles.accountTotal}>{formatCFA(debt)}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={40} color={W.textMuted} />
              <Text style={styles.emptyText}>{emptyText[tab]}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ActivityRow item={item} variant={tab === 'reverse' ? 'commission' : 'default'} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: W.canvas },
  list: { paddingHorizontal: R.space.gut, paddingBottom: R.space.xxl, flexGrow: 1 },
  header: { gap: R.space.md },
  title: { fontFamily: R.font.displayXBold, fontSize: 24, color: W.textPrim, paddingTop: R.space.sm },
  withdraw: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: R.space.sm,
    height: 54,
    borderRadius: W.radius.btn,
    backgroundColor: W.green,
  },
  withdrawOff: { opacity: 0.45 },
  withdrawText: { fontFamily: R.font.bodyBold, fontSize: 15, color: '#FFFFFF' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -R.space.xs,
  },
  hintText: { fontFamily: R.font.body, fontSize: 12, color: W.textMuted },
  activityTitle: {
    fontFamily: R.font.display,
    fontSize: 16,
    color: W.textPrim,
    marginTop: R.space.sm,
  },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: W.surface,
    borderWidth: 1,
    borderColor: W.border,
  },
  tabActive: { backgroundColor: W.green, borderColor: W.green },
  tabText: { fontFamily: R.font.bodyBold, fontSize: 12.5, color: W.textSec },
  tabTextActive: { color: '#FFFFFF' },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF1DE',
    borderRadius: W.radius.btn,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.md,
  },
  accountLabel: { fontFamily: R.font.mono, fontSize: 10.5, letterSpacing: 0.6, color: '#A96C12' },
  accountTotal: { fontFamily: R.font.displayXBold, fontSize: 16, color: '#A96C12' },
  empty: { alignItems: 'center', gap: R.space.sm, paddingTop: 48, paddingHorizontal: R.space.xl },
  emptyText: { fontFamily: R.font.body, fontSize: 13.5, color: W.textMuted, textAlign: 'center' },
});
