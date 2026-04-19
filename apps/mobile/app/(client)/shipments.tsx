import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui';
import { DeliveryCard } from '@/components/delivery';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';
import { DeliveryStatus } from '@/types';

const filters: { label: string; value: DeliveryStatus | 'all' }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'En cours', value: 'delivering' },
  { label: 'Livrees', value: 'delivered' },
  { label: 'Annulees', value: 'cancelled' },
];

export default function ShipmentsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { deliveries, fetchDeliveries, isLoading, setActiveDelivery } = useDeliveryStore();
  const [activeFilter, setActiveFilter] = useState<DeliveryStatus | 'all'>('all');

  useEffect(() => {
    if (user) {
      fetchDeliveries(user.id, 'client');
    }
  }, [user]);

  const filtered = activeFilter === 'all'
    ? deliveries
    : deliveries.filter((d) => d.status === activeFilter);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mes envois</Text>

      {/* Filters */}
      <View style={styles.filters}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filter, activeFilter === f.value && styles.filterActive]}
            onPress={() => setActiveFilter(f.value)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DeliveryCard
            delivery={item}
            onPress={() => {
              // Si la livraison est en cours, on va sur le suivi live; sinon sur le detail.
              const inProgress = [
                'pending',
                'accepted',
                'picking_up',
                'picked_up',
                'delivering',
              ].includes(item.status);
              if (inProgress) {
                setActiveDelivery(item);
                router.push('/(client)/active-delivery');
              } else {
                router.push(`/delivery/${item.id}` as any);
              }
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="Aucun envoi"
            subtitle="Vos livraisons apparaitront ici"
            actionLabel="Envoyer un colis"
            onAction={() => router.push('/(client)/new-delivery')}
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
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
  },
  filterActive: {
    backgroundColor: colors.primaryLight,
  },
  filterText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primaryDark,
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
