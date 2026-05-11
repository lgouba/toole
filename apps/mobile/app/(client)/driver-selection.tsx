import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { EmptyState, SkeletonList } from '@/components/ui';
import { DriverCard } from '@/components/driver';
import { colors, typography, spacing } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';

export default function DriverSelectionScreen() {
  const router = useRouter();
  const { nearbyDrivers, fetchNearbyDrivers, selectDriver } = useDeliveryStore();
  const userLocation = useLocationStore((s) => s.current);
  const refreshLocation = useLocationStore((s) => s.refresh);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const pos = userLocation ?? (await refreshLocation());
      await fetchNearbyDrivers(pos ?? getCenter());
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (driver: any) => {
    selectDriver(driver);
    router.push('/(client)/active-delivery');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Choisir un livreur</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={nearbyDrivers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DriverCard driver={item} onPress={() => handleSelect(item)} />
        )}
        ListEmptyComponent={
          !loaded ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              icon="bicycle-outline"
              title="Aucun livreur disponible"
              subtitle="Aucun livreur n'est en ligne dans votre zone pour le moment. Réessayez dans quelques minutes."
              tone="warning"
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
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
