import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { formatCFA } from '@/utils/format';

export default function DeliveryConfirmScreen() {
  const router = useRouter();
  const { activeDelivery, confirmDelivery } = useDriverStore();

  const handleDone = async () => {
    await confirmDelivery('');
    router.replace('/(driver)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
        </View>

        <Text style={styles.title}>Livraison terminée !</Text>

        {activeDelivery && (
          <Card style={styles.earnings}>
            <Text style={styles.earningsLabel}>Votre gain</Text>
            <Text style={styles.earningsValue}>
              {formatCFA(activeDelivery.driverCommission || activeDelivery.price)}
            </Text>
            {activeDelivery.tip > 0 && (
              <Text style={styles.tip}>+ {formatCFA(activeDelivery.tip)} pourboire</Text>
            )}
          </Card>
        )}

        {activeDelivery && (
          <Card style={styles.summary}>
            <View style={styles.row}>
              <Text style={styles.label}>Référence</Text>
              <Text style={styles.value}>{activeDelivery.reference}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Destinataire</Text>
              <Text style={styles.value}>{activeDelivery.recipientName}</Text>
            </View>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Retour à l'accueil" onPress={handleDone} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  earnings: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  earningsLabel: {
    ...typography.captionMedium,
    color: colors.primaryDark,
  },
  earningsValue: {
    ...typography.h1,
    color: colors.primaryDark,
    marginVertical: spacing.xs,
  },
  tip: {
    ...typography.bodySmall,
    color: colors.primaryDark,
  },
  summary: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
