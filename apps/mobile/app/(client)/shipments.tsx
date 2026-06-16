import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SkeletonList } from '@/components/ui';
import { recap as R, shipments as S } from '@/theme/recapTokens';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';
import { toBucket } from '@/utils/relativeTime';
import { StatusFilters, FilterValue } from '@/components/shipments/StatusFilters';
import { ShipmentCard } from '@/components/shipments/ShipmentCard';

const EN_COURS = ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering', 'scheduled'];

export default function ShipmentsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { deliveries, fetchDeliveries, isLoading, setActiveDelivery } = useDeliveryStore();
  const [filter, setFilter] = useState<FilterValue>('all');

  const load = useCallback(() => {
    if (user) fetchDeliveries(user.id, 'client');
  }, [user, fetchDeliveries]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => (filter === 'all' ? deliveries : deliveries.filter((d) => toBucket(d.status) === filter)),
    [deliveries, filter],
  );

  const open = (item: (typeof deliveries)[number]) => {
    if (EN_COURS.includes(item.status)) {
      setActiveDelivery(item);
      router.push('/(client)/active-delivery');
    } else {
      router.push(`/delivery/${item.id}` as any);
    }
  };

  const noneAtAll = !isLoading && deliveries.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Mes envois</Text>
      <StatusFilters value={filter} onChange={setFilter} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading && deliveries.length > 0} onRefresh={load} tintColor={S.green} />
        }
        renderItem={({ item }) => (
          <ShipmentCard
            delivery={item}
            onPress={() => open(item)}
            onTrack={() => {
              setActiveDelivery(item);
              router.push('/(client)/active-delivery');
            }}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: R.space.lg }}>
              <SkeletonList count={4} />
            </View>
          ) : noneAtAll ? (
            <View style={styles.empty}>
              <MaterialIcons name="inventory-2" size={44} color={S.textMuted} />
              <Text style={styles.emptyTitle}>Aucun envoi pour l'instant</Text>
              <Text style={styles.emptySub}>Tes livraisons apparaîtront ici.</Text>
              <TouchableOpacity style={styles.cta} onPress={() => router.push('/(client)/new-delivery')}>
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.ctaText}>Envoyer un colis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="inventory-2" size={40} color={S.textMuted} />
              <Text style={styles.emptySub}>Aucun envoi dans cette catégorie.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: S.canvas },
  title: {
    fontFamily: R.font.displayXBold,
    fontSize: 24,
    color: S.textPrim,
    paddingHorizontal: R.space.gut,
    paddingTop: R.space.sm,
    paddingBottom: R.space.md,
  },
  list: { paddingHorizontal: R.space.gut, paddingBottom: R.space.xxl, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: R.space.sm },
  emptyTitle: { fontFamily: R.font.display, fontSize: 17, color: S.textPrim, marginTop: R.space.xs },
  emptySub: { fontFamily: R.font.body, fontSize: 13.5, color: S.textMuted, textAlign: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.sm,
    backgroundColor: S.green,
    paddingHorizontal: R.space.gut,
    paddingVertical: R.space.md,
    borderRadius: R.radius.pill,
    marginTop: R.space.md,
  },
  ctaText: { fontFamily: R.font.bodyBold, fontSize: 14, color: '#FFFFFF' },
});
