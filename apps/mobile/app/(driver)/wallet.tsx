import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SkeletonList } from '@/components/ui';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import { getMyWallet, getMyTransactions, WalletSnapshot, Transaction } from '@/services/wallet.service';
import { WalletCard } from '@/components/driver/wallet/WalletCard';
import { RemitAlert } from '@/components/driver/wallet/RemitAlert';
import { ActivityRow } from '@/components/driver/wallet/ActivityRow';

export default function WalletScreen() {
  const router = useRouter();
  const [snap, setSnap] = useState<WalletSnapshot | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [w, t] = await Promise.all([getMyWallet(), getMyTransactions()]);
      setSnap(w);
      setTxs(t);
    } catch {
      /* silent */
    }
  };

  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const balance = snap?.balance ?? 0;
  const totalEarned = snap?.totalEarned ?? 0;
  const debt = snap?.commissionDebt ?? 0;
  const canWithdraw = balance > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={txs}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={W.green} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Portefeuille</Text>

            <WalletCard balance={balance} totalEarned={totalEarned} />

            <TouchableOpacity
              style={[styles.withdraw, !canWithdraw && styles.withdrawOff]}
              disabled={!canWithdraw}
              onPress={() => router.push(`/wallet-flow?mode=withdraw&max=${balance}` as any)}
              activeOpacity={0.9}
            >
              <MaterialIcons name="account-balance-wallet" size={20} color="#FFFFFF" />
              <Text style={styles.withdrawText}>Retirer vers Mobile Money</Text>
            </TouchableOpacity>

            {debt > 0 ? (
              <RemitAlert amount={debt} onPress={() => router.push('/(driver)/remit' as any)} />
            ) : (
              <View style={styles.okChip}>
                <MaterialIcons name="check-circle" size={16} color={W.green} />
                <Text style={styles.okText}>À jour avec Toolé — rien à reverser.</Text>
              </View>
            )}

            <Text style={styles.activityTitle}>Activité</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={40} color={W.textMuted} />
              <Text style={styles.emptyText}>
                Tes gains, retraits et reversements apparaîtront ici.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <ActivityRow tx={item} />}
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
  okChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.sm,
    backgroundColor: '#EEF5EA',
    borderRadius: W.radius.btn,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.md,
  },
  okText: { fontFamily: R.font.body, fontSize: 12.5, color: W.green },
  activityTitle: {
    fontFamily: R.font.display,
    fontSize: 16,
    color: W.textPrim,
    marginTop: R.space.sm,
  },
  empty: { alignItems: 'center', gap: R.space.sm, paddingTop: 60, paddingHorizontal: R.space.xl },
  emptyText: { fontFamily: R.font.body, fontSize: 13.5, color: W.textMuted, textAlign: 'center' },
});
