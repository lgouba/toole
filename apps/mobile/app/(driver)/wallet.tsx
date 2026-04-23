import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatCFA, formatDateTime } from '@/utils/format';
import {
  getMyWallet,
  getMyTransactions,
  formatPhoneForDisplay,
  TX_TYPE_LABEL,
  WalletSnapshot,
  Transaction,
} from '@/services/wallet.service';

export default function WalletScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [w, t] = await Promise.all([getMyWallet(), getMyTransactions()]);
      setWallet(w);
      setTxs(t);
    } catch {
      // silent
    }
  };

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const debt = wallet?.commissionDebt ?? 0;
  const balance = wallet?.balance ?? 0;
  const hasDebt = debt > 0;
  const canWithdraw = balance > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={txs}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Portefeuille</Text>

            {/* Card principale : dette ou solde */}
            {hasDebt ? (
              <View style={[styles.balanceCard, styles.balanceCardDebt]}>
                <View style={styles.balanceRow}>
                  <View>
                    <Text style={styles.balanceLabel}>
                      À régler à la plateforme
                    </Text>
                    <Text style={styles.balanceValueDebt}>
                      {formatCFA(debt)}
                    </Text>
                    <Text style={styles.balanceHint}>
                      Commission des courses payées cash
                    </Text>
                  </View>
                  <View style={styles.debtIconWrap}>
                    <Ionicons
                      name="alert-circle"
                      size={32}
                      color={colors.error}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() =>
                    router.push(`/wallet-flow?mode=topup&amount=${debt}`)
                  }
                >
                  <Ionicons name="wallet" size={18} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Régler maintenant</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <View>
                    <Text style={styles.balanceLabel}>Solde disponible</Text>
                    <Text style={styles.balanceValue}>{formatCFA(balance)}</Text>
                    <Text style={styles.balanceHint}>
                      {canWithdraw
                        ? 'Disponible pour retrait'
                        : 'Effectuez des livraisons pour gagner'}
                    </Text>
                  </View>
                  <View style={styles.walletIconWrap}>
                    <Ionicons name="wallet" size={32} color={colors.primary} />
                  </View>
                </View>
                {canWithdraw ? (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => router.push('/wallet-flow?mode=withdraw')}
                  >
                    <Ionicons
                      name="arrow-down-circle"
                      size={18}
                      color={colors.white}
                    />
                    <Text style={styles.primaryBtnText}>Retirer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Stats rapides */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {wallet?.totalDeliveries ?? 0}
                </Text>
                <Text style={styles.statLabel}>Livraisons</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {hasDebt ? formatCFA(debt) : '—'}
                </Text>
                <Text style={styles.statLabel}>Dette cash</Text>
              </View>
            </View>

            <Text style={styles.historyTitle}>Historique</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons
                name="receipt-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <TransactionRow tx={item} />}
        contentContainerStyle={styles.scroll}
      />
    </SafeAreaView>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isPositive = tx.amount > 0;
  const iconByType: Record<Transaction['type'], keyof typeof Ionicons.glyphMap> = {
    payment: 'cash-outline',
    commission: 'bicycle-outline',
    commission_debt: 'remove-circle-outline',
    tip: 'gift-outline',
    topup: 'arrow-up-circle-outline',
    withdrawal: 'arrow-down-circle-outline',
    withdrawal_fee: 'card-outline',
    adjustment: 'construct-outline',
  };
  const statusBadge =
    tx.status === 'pending'
      ? { bg: colors.warningLight, color: colors.warning, label: 'En attente' }
      : tx.status === 'failed'
        ? { bg: colors.errorLight, color: colors.error, label: 'Échoué' }
        : null;

  return (
    <View style={styles.txRow}>
      <View
        style={[
          styles.txIcon,
          {
            backgroundColor: isPositive
              ? colors.primaryLight
              : colors.errorLight,
          },
        ]}
      >
        <Ionicons
          name={iconByType[tx.type]}
          size={18}
          color={isPositive ? colors.primary : colors.error}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.txTopRow}>
          <Text style={styles.txLabel} numberOfLines={1}>
            {TX_TYPE_LABEL[tx.type]}
          </Text>
          <Text
            style={[
              styles.txAmount,
              { color: isPositive ? colors.primary : colors.error },
            ]}
          >
            {isPositive ? '+' : ''}
            {formatCFA(tx.amount)}
          </Text>
        </View>
        <View style={styles.txBottomRow}>
          <Text style={styles.txMeta} numberOfLines={1}>
            {tx.delivery?.reference
              ? `${tx.delivery.reference} · `
              : tx.phoneNumber
                ? `${formatPhoneForDisplay(tx.phoneNumber)} · `
                : ''}
            {formatDateTime(tx.createdAt)}
          </Text>
          {statusBadge ? (
            <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
              <Text style={[styles.badgeText, { color: statusBadge.color }]}>
                {statusBadge.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  pageTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  balanceCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  balanceCardDebt: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  balanceValueDebt: {
    ...typography.h1,
    color: colors.error,
    marginTop: spacing.xs,
  },
  balanceHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  walletIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  txAmount: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  txBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing.sm,
  },
  txMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 10,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
