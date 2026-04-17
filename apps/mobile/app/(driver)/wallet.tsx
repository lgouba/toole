import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useWalletStore } from '@/stores/wallet.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatCFA, formatRelativeTime } from '@/utils/format';
import { TRANSACTION_LABELS, PAYMENT_METHOD_LABELS, Transaction } from '@/types';

export default function WalletScreen() {
  const user = useAuthStore((s) => s.user);
  const { balance, transactions, fetchBalance, fetchTransactions, topUp, withdraw, isLoading } =
    useWalletStore();
  const [modalType, setModalType] = useState<'topup' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchTransactions(user.id);
    }
  }, [user]);

  const handleAction = async () => {
    if (!user || !amount) return;
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (modalType === 'topup') {
      await topUp(user.id, numAmount, 'orange_money');
    } else {
      await withdraw(user.id, numAmount, 'orange_money');
    }
    setModalType(null);
    setAmount('');
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'commission' || item.type === 'tip' || item.type === 'topup';

    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isIncome ? colors.primaryLight : colors.errorLight }]}>
          <Ionicons
            name={isIncome ? 'arrow-down' : 'arrow-up'}
            size={16}
            color={isIncome ? colors.primary : colors.error}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{TRANSACTION_LABELS[item.type]}</Text>
          <Text style={styles.txMethod}>{PAYMENT_METHOD_LABELS[item.paymentMethod]}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: isIncome ? colors.primary : colors.error }]}>
            {isIncome ? '+' : '-'}{formatCFA(item.amount)}
          </Text>
          <Text style={styles.txTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde disponible</Text>
        <Text style={styles.balanceValue}>{formatCFA(balance)}</Text>
        <View style={styles.balanceActions}>
          <Button
            title="Recharger"
            size="small"
            onPress={() => setModalType('topup')}
            style={styles.balanceBtn}
          />
          <Button
            title="Retirer"
            variant="outline"
            size="small"
            onPress={() => setModalType('withdraw')}
            style={styles.balanceBtn}
          />
        </View>
      </View>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Historique</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.txList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucune transaction</Text>
        }
      />

      {/* Modal */}
      <Modal visible={modalType !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'topup' ? 'Recharger' : 'Retirer'}
              </Text>
              <TouchableOpacity onPress={() => { setModalType(null); setAmount(''); }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Input
              label="Montant (FCFA)"
              placeholder="5000"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              containerStyle={styles.modalInput}
            />

            <Text style={styles.modalInfo}>
              Via Orange Money
            </Text>

            <Button
              title={modalType === 'topup' ? 'Recharger' : 'Retirer'}
              onPress={handleAction}
              loading={isLoading}
              disabled={!amount}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  balanceLabel: {
    ...typography.captionMedium,
    color: 'rgba(255,255,255,0.8)',
  },
  balanceValue: {
    ...typography.h1,
    color: colors.white,
    marginVertical: spacing.sm,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  balanceBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  txList: {
    paddingHorizontal: spacing.lg,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  txMethod: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  txTime: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalInput: {
    marginBottom: spacing.md,
  },
  modalInfo: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
