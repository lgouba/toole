import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, wallet as W } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';
import { getMyWallet, getMyTransactions, WalletSnapshot, Transaction } from '@/services/wallet.service';
import { ActivityRow } from '@/components/driver/wallet/ActivityRow';

const REMIT_TYPES = new Set<Transaction['type']>(['commission_debt', 'topup', 'adjustment']);

/** "À reverser à Toolé" : part plateforme des courses payées en espèces. */
export default function RemitScreen() {
  const router = useRouter();
  const [snap, setSnap] = useState<WalletSnapshot | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [w, t] = await Promise.all([getMyWallet(), getMyTransactions()]);
      setSnap(w);
      setTxs(t.filter((x) => REMIT_TYPES.has(x.type)));
    } catch {
      /* silent */
    }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const debt = snap?.commissionDebt ?? 0;
  const effectiveDebt = snap?.effectiveDebt ?? 0;
  const pending = snap?.pendingTopupAmount ?? 0;
  const canPay = effectiveDebt > 0;
  const upToDate = debt <= 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <MaterialIcons name="arrow-back" size={22} color={W.textPrim} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>À reverser</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={txs}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={W.amberFg} />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {upToDate ? (
              <View style={styles.okHero}>
                <MaterialIcons name="check-circle" size={36} color={W.green} />
                <Text style={styles.okTitle}>Tu es à jour ✓</Text>
                <Text style={styles.okSub}>Aucune part à reverser à Toolé.</Text>
              </View>
            ) : (
              <>
                <View style={styles.hero}>
                  <Text style={styles.heroLabel}>À REVERSER À TOOLÉ</Text>
                  <Text style={styles.heroAmount}>{formatCFA(effectiveDebt)}</Text>
                  <Text style={styles.heroSub}>Part plateforme des courses payées en espèces.</Text>
                  {pending > 0 ? (
                    <Text style={styles.heroPending}>
                      {formatCFA(pending)} en attente de validation
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.note}>
                  Tu encaisses le cash sur les courses ; reverse la part Toolé via Mobile
                  Money pour garder ton compte actif.
                </Text>

                {canPay ? (
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => router.push(`/wallet-flow?mode=topup&amount=${effectiveDebt}` as any)}
                    activeOpacity={0.9}
                  >
                    <MaterialIcons name="south-west" size={20} color="#FFFFFF" />
                    <Text style={styles.payText}>Reverser {formatCFA(effectiveDebt)}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pendingChip}>
                    <MaterialIcons name="schedule" size={16} color={W.amberFg} />
                    <Text style={styles.pendingText}>En attente de validation admin</Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.histTitle}>Historique</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun reversement pour l'instant.</Text>
        }
        renderItem={({ item }) => <ActivityRow tx={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: W.canvas },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: R.space.gut,
    paddingVertical: R.space.sm,
  },
  back: { padding: 2 },
  headerTitle: { fontFamily: R.font.display, fontSize: 16, color: W.textPrim },
  list: { paddingHorizontal: R.space.gut, paddingBottom: R.space.xxl },
  header: { gap: R.space.md },
  hero: {
    backgroundColor: W.amberBg,
    borderWidth: 1,
    borderColor: W.amberBorder,
    borderRadius: W.radius.card,
    padding: R.space.pad,
    gap: 3,
  },
  heroLabel: { fontFamily: R.font.mono, fontSize: 10, letterSpacing: 1.4, color: W.amberFg },
  heroAmount: { fontFamily: R.font.displayXBold, fontSize: 34, color: W.amberFg, marginTop: 2 },
  heroSub: { fontFamily: R.font.body, fontSize: 12.5, color: W.amberFg, opacity: 0.9, marginTop: 2 },
  heroPending: { fontFamily: R.font.mono, fontSize: 11, color: W.amberFg, opacity: 0.8, marginTop: 6 },
  note: { fontFamily: R.font.body, fontSize: 13, color: W.textSec, lineHeight: 19 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: R.space.sm,
    height: 52,
    borderRadius: W.radius.btn,
    backgroundColor: W.amberFg,
  },
  payText: { fontFamily: R.font.bodyBold, fontSize: 15, color: '#FFFFFF' },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.sm,
    backgroundColor: W.amberBg,
    borderRadius: W.radius.btn,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.md,
  },
  pendingText: { fontFamily: R.font.body, fontSize: 12.5, color: W.amberFg },
  okHero: { alignItems: 'center', gap: R.space.sm, paddingVertical: R.space.xl },
  okTitle: { fontFamily: R.font.display, fontSize: 18, color: W.textPrim },
  okSub: { fontFamily: R.font.body, fontSize: 13, color: W.textSec },
  histTitle: { fontFamily: R.font.display, fontSize: 16, color: W.textPrim, marginTop: R.space.sm },
  empty: { fontFamily: R.font.body, fontSize: 13, color: W.textMuted, textAlign: 'center', paddingTop: R.space.xl },
});
