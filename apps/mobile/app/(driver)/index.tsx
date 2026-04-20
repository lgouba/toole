import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { OnlineToggle, StatsCard } from '@/components/driver';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useDriverStore } from '@/stores/driver.store';
import { DEFAULT_MAP_REGION } from '@/utils/geo';
import { getMyKyc, DriverKyc } from '@/services/driver.service';

export default function DriverHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { isOnline, toggleOnline, todayDeliveries, todayEarnings } = useDriverStore();
  const [kyc, setKyc] = useState<DriverKyc | null>(null);

  useEffect(() => {
    getMyKyc().then(setKyc).catch(() => {});
  }, []);

  const firstName = user?.fullName.split(' ')[0] || 'Livreur';
  const kycIncomplete =
    kyc &&
    kyc.verificationStatus !== 'verified' &&
    (!kyc.cnibPhotoUrl || !kyc.vehiclePhotoUrl || !kyc.licensePhotoUrl);
  const kycRejected = kyc?.verificationStatus === 'rejected';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Bonjour, {firstName}</Text>

        {/* KYC banner */}
        {kycRejected ? (
          <TouchableOpacity
            style={[styles.kycBanner, styles.kycBannerError]}
            onPress={() => router.push('/(driver)/kyc')}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={22} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.kycBannerTitle, { color: colors.error }]}>
                Dossier refuse
              </Text>
              <Text style={styles.kycBannerHint}>
                {kyc?.verificationNote || 'Corrigez les informations et renvoyez.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.error} />
          </TouchableOpacity>
        ) : kycIncomplete ? (
          <TouchableOpacity
            style={[styles.kycBanner, styles.kycBannerWarning]}
            onPress={() => router.push('/(driver)/kyc')}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.kycBannerTitle, { color: '#a66908' }]}>
                Completez votre dossier
              </Text>
              <Text style={styles.kycBannerHint}>
                Envoyez vos documents pour etre active.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.warning} />
          </TouchableOpacity>
        ) : null}

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
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  kycBannerWarning: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  kycBannerError: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  kycBannerTitle: {
    ...typography.bodyMedium,
  },
  kycBannerHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
