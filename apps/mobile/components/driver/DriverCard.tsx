import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Avatar, Rating } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { DriverWithProfile, VehicleType } from '@/types';
import { formatDistance } from '@/utils/format';

const VEHICLE_ICONS: Record<VehicleType, string> = {
  moto: 'bicycle',
  velo: 'walk',
  voiture: 'car',
  tricycle: 'bus',
};

const VEHICLE_LABELS: Record<VehicleType, string> = {
  moto: 'Moto',
  velo: 'Velo',
  voiture: 'Voiture',
  tricycle: 'Tricycle',
};

interface DriverCardProps {
  driver: DriverWithProfile;
  onPress?: () => void;
}

export function DriverCard({ driver, onPress }: DriverCardProps) {
  const profile = driver.driverProfile;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Avatar name={driver.fullName} uri={driver.avatarUrl} size="lg" />
        <View style={styles.info}>
          <Text style={styles.name}>{driver.fullName}</Text>
          <View style={styles.meta}>
            <Rating value={driver.ratingAvg} size={14} readonly />
            <Text style={styles.ratingText}>{driver.ratingAvg.toFixed(1)}</Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.deliveries}>{profile.totalDeliveries} courses</Text>
          </View>
          <View style={styles.vehicleRow}>
            <Ionicons
              name={VEHICLE_ICONS[profile.vehicleType] as any}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.vehicleText}>{VEHICLE_LABELS[profile.vehicleType]}</Text>
          </View>
        </View>
        {driver.distance !== undefined && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{formatDistance(driver.distance)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    ...typography.caption,
    color: colors.warning,
    marginLeft: 4,
  },
  dot: {
    color: colors.textTertiary,
  },
  deliveries: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  distanceBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  distanceText: {
    ...typography.captionMedium,
    color: colors.primaryDark,
  },
});
