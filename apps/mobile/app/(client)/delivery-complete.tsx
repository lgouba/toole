import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Rating } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { formatCFA } from '@/utils/format';

export default function DeliveryCompleteScreen() {
  const router = useRouter();
  const { activeDelivery, activeDriver, clear } = useDeliveryStore();
  const [rating, setRating] = useState(0);

  const handleDone = () => {
    clear();
    router.replace('/(client)');
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

        <Text style={styles.title}>Livraison confirmee !</Text>
        <Text style={styles.subtitle}>
          Votre colis a ete livre avec succes
        </Text>

        {activeDelivery && (
          <Card style={styles.summary}>
            <View style={styles.row}>
              <Text style={styles.label}>Reference</Text>
              <Text style={styles.value}>{activeDelivery.reference}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Destinataire</Text>
              <Text style={styles.value}>{activeDelivery.recipientName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Montant</Text>
              <Text style={styles.valueGreen}>{formatCFA(activeDelivery.price)}</Text>
            </View>
          </Card>
        )}

        {activeDriver && (
          <View style={styles.ratingSection}>
            <Text style={styles.ratingTitle}>
              Notez {activeDriver.fullName}
            </Text>
            <Rating value={rating} onChange={setRating} size={36} />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Terminer" onPress={handleDone} />
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  summary: {
    width: '100%',
    marginBottom: spacing.xl,
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
  valueGreen: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  ratingSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  ratingTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
