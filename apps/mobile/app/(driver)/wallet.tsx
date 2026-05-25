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

type Tab = 'gains' | 'debt';

// Types de transactions affiches dans chaque onglet.
// Onglet "Mes gains" : tout ce qui credite le livreur (gain de course, pourboire,
//   retrait via OM, ajustement positif).
// Onglet "Commission a reverser" : tout ce qui touche la dette plateforme
//   (debit commission cash + reversements OM).
const GAINS_TYPES = new Set<Transaction['type']>([
  'commission',
  'tip',
  'withdrawal',
  'withdrawal_fee',
  'payment',
]);
const DEBT_TYPES = new Set<Transaction['type']>([
  'commission_debt',
  'topup',
  'adjustment',
]);

export default function WalletScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('gains');

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
  const pending = wallet?.pendingTopupAmount ?? 0;
  const effectiveDebt = wallet?.effectiveDebt ?? 0;
  const balance = wallet?.balance ?? 0;
  const totalEarned = wallet?.totalEarned ?? 0;
  const hasDebt = debt > 0;
  // Le livreur peut reverser seulement si la dette nette est > 0
  // (sinon tout est déjà en attente de validation)
  const canPay = effectiveDebt > 0;
  const canWithdraw = balance > 0;

  // Filtre les transactions selon l'onglet actif.
  const filteredTxs = txs.filter((t) =>
    tab === 'gains' ? GAINS_TYPES.has(t.type) : DEBT_TYPES.has(t.type),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredTxs}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Portefeuille</Text>

            {/* ============================================ */}
            {/* Onglets : Mes gains / Commission a reverser  */}
            {/* ============================================ */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => setTab('gains')}
                style={[
                  styles.tabBtn,
                  tab === 'gains' && styles.tabBtnActive,
                ]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="trending-up"
                  size={16}
                  color={tab === 'gains' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    tab === 'gains' && styles.tabLabelActive,
                  ]}
                >
                  Mes gains
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTab('debt')}
                style={[
                  styles.tabBtn,
                  tab === 'debt' && styles.tabBtnActive,
                ]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={tab === 'debt' ? colors.error : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    tab === 'debt' && {
                      color: colors.error,
                      fontWeight: '700',
                    },
                  ]}
                >
                  À reverser
                </Text>
                {hasDebt ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>!</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {tab === 'gains' ? (
              <>
                {/* ============================================ */}
                {/* Onglet GAINS                                  */}
                {/* ============================================ */}
                <View style={[styles.metricCard, styles.metricCardGain]}>
                  <View style={styles.metricHeader}>
                    <View style={styles.metricIconGain}>
                      <Ionicons
                        name="trending-up"
                        size={20}
                        color={colors.white}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel}>Disponible à retirer</Text>
                      <Text style={styles.metricHint}>
                        Solde net après dette commission
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.metricValueGain}>
                    {formatCFA(balance)}
                  </Text>

                  {/* Detail secondaire : total gagne historique + dette en cours.
                      Aide le livreur a comprendre pourquoi disponible < gains. */}
                  {(totalEarned !== balance || hasDebt) && (
                    <View style={styles.gainBreakdown}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Total gagné</Text>
                        <Text style={styles.breakdownValue}>
                          {formatCFA(totalEarned)}
                        </Text>
                      </View>
                      {hasDebt && (
                        <View style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLabel, { color: colors.error }]}>
                            Commission à reverser
                          </Text>
                          <Text style={[styles.breakdownValue, { color: colors.error }]}>
                            −{formatCFA(debt)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Bouton retrait : visible des qu'il y a quelque chose
                      de retirable via OM (paiements en ligne accumules dans
                      le wallet). Sans ca, le livreur n'a rien a retirer car
                      les gains cash sont deja en sa possession physique. */}
                  {canWithdraw ? (
                    <TouchableOpacity
                      style={styles.actionBtnGain}
                      onPress={() => router.push(`/wallet-flow?mode=withdraw&max=${balance}`)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="arrow-down-circle"
                        size={18}
                        color={colors.white}
                      />
                      <Text style={styles.actionBtnText}>
                        Retirer
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                {/* ============================================ */}
                {/* Onglet COMMISSION À REVERSER                  */}
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
                    <Text style={styles.metricValueDebt}>
                      {formatCFA(effectiveDebt)}
                    </Text>

                    {pending > 0 ? (
                      <View style={styles.debtBreakdown}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Dette totale</Text>
                          <Text style={styles.breakdownValue}>
                            {formatCFA(debt)}
                          </Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <View style={styles.breakdownLabelRow}>
                            <Ionicons
                              name="time-outline"
                              size={13}
                              color={colors.warning}
                            />
                            <Text
                              style={[
                                styles.breakdownLabel,
                                { color: colors.warning },
                              ]}
                            >
                              En attente de validation
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.breakdownValue,
                              { color: colors.warning },
                            ]}
                          >
                            −{formatCFA(pending)}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {canPay ? (
                      <TouchableOpacity
                        style={styles.actionBtnDebt}
                        onPress={() =>
                          router.push(
                            `/wallet-flow?mode=topup&amount=${effectiveDebt}`,
                          )
                        }
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="wallet"
                          size={18}
                          color={colors.white}
                        />
                        <Text style={styles.actionBtnText}>
                          Reverser {formatCFA(effectiveDebt)}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.actionBtnPending}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={colors.warning}
                        />
                        <Text style={styles.actionBtnPendingText}>
                          En attente de validation admin
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.metricCardOk}>
                    <Ionicons
                      name="checkmark-circle"
                      size={32}
                      color={colors.primary}
                    />
                    <Text style={styles.metricCardOkTitle}>
                      Aucune commission due
                    </Text>
                    <Text style={styles.metricCardOkHint}>
                      Vous êtes à jour avec la plateforme.
                    </Text>
                  </View>
                )}
              </>
            )}

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

            <Text style={styles.historyTitle}>
              {tab === 'gains' ? 'Historique des gains' : 'Historique des règlements'}
            </Text>
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
        {/* Pour une commission_debt (dette sur course cash), on ajoute le
            prix total de la course pour donner du contexte au livreur :
            "Course coute 2500 FCFA, commission a reverser 875 FCFA" */}
        {tx.type === 'commission_debt' && tx.delivery?.price != null ? (
          <Text style={styles.txCourseTotal}>
            Course de {formatCFA(tx.delivery.price)}
          </Text>
        ) : null}
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
  debtBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    gap: 6,
  },
  gainBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    gap: 6,
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  breakdownValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionBtnPending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderStyle: 'dashed',
  },
  actionBtnPendingText: {
    ...typography.bodySmall,
    color: colors.warning,
    fontWeight: '700',
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
  // ============== Tabs ==============
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  // ============== Sub-card (retrait dispo) ==============
  subCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subCardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  subCardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  subCardHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  subCardValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  // ============== Etat "aucune dette" ==============
  metricCardOk: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metricCardOkTitle: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  metricCardOkHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
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
  txCourseTotal: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
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
