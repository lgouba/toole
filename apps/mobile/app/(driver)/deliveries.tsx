import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui';
import { DeliveryCard } from '@/components/delivery';
import { colors, typography, spacing } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';

export default function DriverDeliveriesScreen() {
  const user = useAuthStore((s) => s.user);
  const { deliveries, fetchDeliveries } = useDeliveryStore();

  useEffect(() => {
    if (user) {
      fetchDeliveries(user.id, 'driver');
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mes livraisons</Text>
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <DeliveryCard delivery={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="Aucune livraison"
            subtitle="Passez en ligne pour recevoir des demandes"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: {
    padding: spacing.md,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
