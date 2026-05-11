import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, SkeletonList } from '@/components/ui';
import { DeliveryCard } from '@/components/delivery';
import { colors, typography, spacing } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';

export default function DriverDeliveriesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { deliveries, fetchDeliveries, isLoading } = useDeliveryStore();

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
        renderItem={({ item }) => (
          <DeliveryCard
            delivery={item}
            onPress={() => router.push(`/delivery/${item.id}` as any)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              icon="bicycle-outline"
              title="Pas encore de course"
              subtitle="Passez en ligne pour recevoir des demandes. Chaque course terminée apparaîtra dans votre historique."
              tone="primary"
            />
          )
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
