import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { useCountdown } from '@/hooks/useCountdown';
import { haptic } from '@/utils/haptics';
import { formatCFA, formatDistance, formatDuration } from '@/utils/format';
import { PACKAGE_LABELS } from '@/types';

export default function NewRequestScreen() {
  const router = useRouter();
  const { currentRequest, acceptRequest, rejectRequest } = useDriverStore();

  const { remaining, start } = useCountdown(120, () => {
    // Auto-reject on timeout
    rejectRequest();
    router.replace('/(driver)');
  });

  // Redemarre le countdown a chaque nouvelle demande (sinon le timer reste fige
  // quand l'ecran est deja monte et qu'une nouvelle demande arrive).
  useEffect(() => {
    if (currentRequest) {
      start();
    }
  }, [currentRequest?.id]);

  // Si la demande devient invalide (annulee, expiree, prise par un autre livreur),
  // le store la met a null. On revient au dashboard driver.
  useEffect(() => {
    if (!currentRequest) {
      router.replace('/(driver)');
    }
  }, [currentRequest, router]);

  const handleAccept = async () => {
    haptic.success();
    await acceptRequest();
    router.replace('/(driver)/pickup-navigation');
  };

  const handleReject = () => {
    haptic.light();
    rejectRequest();
    router.replace('/(driver)');
  };

  if (!currentRequest) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.noRequest}>Aucune demande</Text>
      </SafeAreaView>
    );
  }

  const timerProgress = remaining / 120;

  return (
    <SafeAreaView style={styles.container}>
      {/* Timer bar */}
      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timerProgress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Nouvelle demande</Text>
        <Text style={styles.timer}>{formatDuration(remaining)}</Text>

        <Card style={styles.details}>
          {/* Package info */}
          <View style={styles.row}>
            <Ionicons name="cube-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>
              {PACKAGE_LABELS[currentRequest.packageType]}
            </Text>
          </View>

          {/* Pickup */}
          <View style={styles.addressSection}>
            <View style={styles.addressRow}>
              <Ionicons name="radio-button-on" size={14} color={colors.primary} />
              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>Recuperation</Text>
                <Text style={styles.address}>{currentRequest.pickupAddress}</Text>
                {currentRequest.pickupDetails && (
                  <Text style={styles.addressDetails}>{currentRequest.pickupDetails}</Text>
                )}
              </View>
            </View>
            <View style={styles.connector} />
            <View style={styles.addressRow}>
              <Ionicons name="location" size={14} color={colors.secondary} />
              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>Livraison</Text>
                <Text style={styles.address}>{currentRequest.deliveryAddress}</Text>
                {currentRequest.deliveryDetails && (
                  <Text style={styles.addressDetails}>{currentRequest.deliveryDetails}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Distance & Price */}
          <View style={styles.bottomRow}>
            <View style={styles.stat}>
              <Ionicons name="navigate-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.statValue}>
                {currentRequest.estimatedDistanceKm
                  ? formatDistance(currentRequest.estimatedDistanceKm)
                  : '-'}
              </Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Gain</Text>
              <Text style={styles.priceValue}>
                {formatCFA(currentRequest.driverCommission || currentRequest.price)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Action buttons */}
      <View style={styles.footer}>
        <Button
          title="Refuser"
          variant="outline"
          onPress={handleReject}
          style={styles.rejectButton}
        />
        <Button
          title="Accepter"
          onPress={handleAccept}
          style={styles.acceptButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  noRequest: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  timerBar: {
    height: 4,
    backgroundColor: colors.surface,
  },
  timerFill: {
    height: 4,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  timer: {
    ...typography.h3,
    color: colors.warning,
    marginBottom: spacing.md,
  },
  details: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  addressSection: {
    gap: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: 2,
  },
  connector: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginLeft: 7,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    ...typography.captionMedium,
    color: colors.textTertiary,
  },
  address: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  addressDetails: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  priceValue: {
    ...typography.h3,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  rejectButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 2,
  },
});
