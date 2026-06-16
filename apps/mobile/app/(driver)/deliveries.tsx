import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SkeletonList } from '@/components/ui';
import { recap as R, deliveries as D } from '@/theme/recapTokens';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { useAuthStore } from '@/stores/auth.store';
import { toBucket } from '@/utils/relativeTime';
import { courierEarning } from '@/utils/courierEarning';
import { WeekSummary } from '@/components/driver/deliveries/WeekSummary';
import { DeliveryFilters, DeliveryFilterValue } from '@/components/driver/deliveries/DeliveryFilters';
import { DriverDeliveryCard } from '@/components/driver/deliveries/DriverDeliveryCard';

/** Début de semaine (lundi 00:00) en heure Ouaga (UTC+0). */
function weekStartUTC(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(d.getTime() - back * 86_400_000);
}

const BUCKET_ORDER: Record<string, number> = { en_cours: 0, livree: 1, annulee: 2 };

export default function DriverDeliveriesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { deliveries, fetchDeliveries, isLoading } = useDeliveryStore();
  const [filter, setFilter] = useState<DeliveryFilterValue>('all');

  const load = useCallback(() => {
    if (user) fetchDeliveries(user.id, 'driver');
  }, [user, fetchDeliveries]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Résumé semaine (courses livrées + gains livreur), fuseau Ouaga.
  const week = useMemo(() => {
    const start = weekStartUTC().getTime();
    const delivered = deliveries.filter(
      (d) => d.status === 'delivered' && new Date(d.createdAt).getTime() >= start,
    );
    return {
      count: delivered.length,
      earnings: delivered.reduce((s, d) => s + courierEarning(d), 0),
    };
  }, [deliveries]);

  // Filtrage + tri (en cours d'abord, puis récent).
  const data = useMemo(() => {
    const list = filter === 'all' ? deliveries : deliveries.filter((d) => toBucket(d.status) === filter);
    return [...list].sort((a, b) => {
      const ord = BUCKET_ORDER[toBucket(a.status)] - BUCKET_ORDER[toBucket(b.status)];
      if (ord !== 0) return ord;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [deliveries, filter]);

  const continueDelivery = (item: (typeof deliveries)[number]) => {
    useDriverStore.setState({ activeDelivery: item });
    const next =
      item.status === 'picked_up' || item.status === 'delivering'
        ? '/(driver)/delivery-navigation'
        : '/(driver)/pickup-navigation';
    router.push(next as any);
  };

  const noneAtAll = !isLoading && deliveries.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WeekSummary count={week.count} earnings={week.earnings} />
      <DeliveryFilters value={filter} onChange={setFilter} />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading && deliveries.length > 0} onRefresh={load} tintColor={D.green} />
        }
        renderItem={({ item }) => (
          <DriverDeliveryCard
            delivery={item}
            onPress={() => router.push(`/delivery/${item.id}` as any)}
            onContinue={() => continueDelivery(item)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: R.space.lg }}>
              <SkeletonList count={4} />
            </View>
          ) : noneAtAll ? (
            <View style={styles.empty}>
              <MaterialIcons name="local-shipping" size={44} color={D.textMuted} />
              <Text style={styles.emptyTitle}>Aucune livraison pour le moment</Text>
              <Text style={styles.emptySub}>Passe en ligne depuis l'accueil pour recevoir des courses.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="local-shipping" size={40} color={D.textMuted} />
              <Text style={styles.emptySub}>Aucune livraison dans cette catégorie.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.canvas },
  list: { paddingHorizontal: R.space.gut, paddingBottom: R.space.xxl, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: R.space.sm },
  emptyTitle: { fontFamily: R.font.display, fontSize: 17, color: D.textPrim, marginTop: R.space.xs },
  emptySub: { fontFamily: R.font.body, fontSize: 13.5, color: D.textMuted, textAlign: 'center', paddingHorizontal: R.space.xl },
});
