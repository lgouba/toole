import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { OnlineToggle, StatsCard } from '@/components/driver';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useDriverStore } from '@/stores/driver.store';
import { DEFAULT_MAP_REGION } from '@/utils/geo';

export default function DriverHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { isOnline, toggleOnline, todayDeliveries, todayEarnings } = useDriverStore();

  const firstName = user?.firstName || user?.fullName.split(' ')[0] || 'Livreur';
  const isActivated = !!user?.isActive;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Bonjour, {firstName}</Text>

        {/* Banniere d'activation */}
        {!isActivated ? (
          <View style={styles.pendingCard}>
            <View style={styles.pendingIconWrap}>
              <Ionicons name="time-outline" size={28} color={colors.warning} />
            </View>
            <Text style={styles.pendingTitle}>Compte en cours de validation</Text>
            <Text style={styles.pendingText}>
              Notre équipe examine votre inscription. Vous recevrez une notification
              dès que votre compte sera activé et vous pourrez commencer à recevoir
              des courses.
            </Text>
          </View>
        ) : (
          <OnlineToggle isOnline={isOnline} onToggle={toggleOnline} />
        )}

        <View style={styles.statsSection}>
          <StatsCard
            deliveriesToday={todayDeliveries}
            earningsToday={todayEarnings}
            ratingAvg={user?.ratingAvg || 5}
          />
        </View>

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
  pendingCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {
    ...typography.h3,
    color: '#a66908',
    textAlign: 'center',
  },
  pendingText: {
    ...typography.bodySmall,
    color: '#a66908',
    textAlign: 'center',
    lineHeight: 20,
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
});
