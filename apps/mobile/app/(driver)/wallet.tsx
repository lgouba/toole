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
import { EmptyState, SkeletonList } from '@/components/ui';
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

            {/* ============================================ */}
            {/* Card 1 : MON GAIN NET (toujours visible)     */}
            {/* ============================================ */}
            <View style={[styles.metricCard, styles.metricCardGain]}>
              <View style={styles.metricHeader}>
                <View style={styles.metricIconGain}>
                  <Ionicons name="trending-up" size={20} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metricLabel}>Mon gain net</Text>
                  <Text style={styles.metricHint}>
                    Disponible pour retrait
                  </Text>
                </View>
              </View>
              <Text style={styles.metricValueGain}>{formatCFA(balance)}</Text>
              {canWithdraw ? (
                <TouchableOpacity
                  style={styles.actionBtnGain}
                  onPress={() => router.push('/wallet-flow?mode=withdraw')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-down-circle" size={18} color={colors.white} />
                  <Text style={styles.actionBtnText}>Retirer</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionBtnDisabled}>
                  <Text style={styles.actionBtnDisabledText}>
                    Effectuez des livraisons pour gagner
                  </Text>
                </View>
              )}
            </View>

            {/* ============================================ */}
            {/* Card 2 : COMMISSION À REVERSER (si > 0)      */}
            {/* ============================================ */}
            {hasDebt ? (
              <View style={[styles.metricCard, styles.metricCardDebt]}>
                <View style={styles.metricHeader}>
                  <View style={styles.metricIconDebt}>
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={colors.white}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metricLabelDebt}>
                      Commission à reverser
                    </Text>
                    <Text style={styles.metricHint}>
                      Sur les courses payées en espèce
                    </Text>
                  </View>
                </View>
                <Text style={styles.metricValueDebt}>{formatCFA(debt)}</Text>
                <TouchableOpacity
                  style={styles.actionBtnDebt}
                  onPress={() =>
                    router.push(`/wallet-flow?mode=topup&amount=${debt}`)
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons name="wallet" size={18} color={colors.white} />
                  <Text style={styles.actionBtnText}>Reverser</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Stat livraisons */}
            <View style={styles.deliveriesPill}>
              <Ionicons
                name="bicycle"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.deliveriesPillText}>
                <Text style={{ fontWeight: '800' }}>
                  {wallet?.totalDeliveries ?? 0}
                </Text>{' '}
                livraison{(wallet?.totalDeliveries ?? 0) > 1 ? 's' : ''}{' '}
                effectuée{(wallet?.totalDeliveries ?? 0) > 1 ? 's' : ''}
              </Text>
            </View>

            <Text style={styles.historyTitle}>Historique</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="Aucune transaction"
              subtitle="Vos gains, retraits et règlements de commission apparaîtront ici dès votre première course."
              tone="neutral"
            />
          )
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
  // ============== Metric cards (gain + dette) ==============
  metricCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  metricCardGain: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '60',
  },
  metricCardDebt: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricIconGain: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconDebt: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '800',
  },
  metricLabelDebt: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '800',
  },
  metricHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  metricValueGain: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  metricValueDebt: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.error,
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  actionBtnGain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  actionBtnDebt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    shadowColor: colors.error,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  actionBtnText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '800',
  },
  actionBtnDisabled: {
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  actionBtnDisabledText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  deliveriesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  deliveriesPillText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
