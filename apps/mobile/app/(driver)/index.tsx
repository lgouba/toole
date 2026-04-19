import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Map } from '@/components/map/Map';
import { OnlineToggle, StatsCard } from '@/components/driver';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useDriverStore } from '@/stores/driver.store';
import { DEFAULT_MAP_REGION } from '@/utils/geo';

export default function DriverHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { isOnline, toggleOnline, todayDeliveries, todayEarnings } = useDriverStore();

  const firstName = user?.fullName.split(' ')[0] || 'Livreur';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Bonjour, {firstName}</Text>

        <OnlineToggle isOnline={isOnline} onToggle={toggleOnline} />

        <View style={styles.statsSection}>
          <StatsCard
            deliveriesToday={todayDeliveries}
            earningsToday={todayEarnings}
            ratingAvg={user?.ratingAvg || 4.9}
          />
        </View>

        {/* Mini map */}
        <View style={styles.mapContainer}>
          <Map
            center={DEFAULT_MAP_REGION}
            zoom={14}
            interactive={false}
            markers={[{ id: 'me', coordinate: DEFAULT_MAP_REGION, icon: 'driver' }]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  greeting: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  statsSection: {
    marginTop: spacing.xs,
  },
  mapContainer: {
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  map: {
    flex: 1,
  },
  myMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
