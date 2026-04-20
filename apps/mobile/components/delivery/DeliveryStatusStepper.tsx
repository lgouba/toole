import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/theme';
import { DeliveryStatus } from '@/types';

/**
 * Etapes affichees au client. On a volontairement simplifie le parcours
 * pour coller aux statuts reellement produits par le backend :
 *   - accepted   : le livreur a accepte, il est en route pour recuperer
 *   - picked_up  : le colis est recupere, il est en route pour livrer
 *   - delivered  : colis livre
 * (les statuts intermediaires picking_up / delivering ne sont plus utilises)
 */
const STEPS: { key: 'accepted' | 'picked_up' | 'delivered'; label: string; icon: string }[] = [
  { key: 'accepted', label: 'Livreur en route vers vous', icon: 'bicycle' },
  { key: 'picked_up', label: 'Colis recupere, en livraison', icon: 'cube' },
  { key: 'delivered', label: 'Livre', icon: 'checkmark-done-circle' },
];

// Ordre logique des statuts pour calculer l'avancement
const STATUS_RANK: Record<DeliveryStatus, number> = {
  pending: 0,
  accepted: 1,
  picking_up: 1,
  picked_up: 2,
  delivering: 2,
  delivered: 3,
  cancelled: -1,
  expired: -1,
};

interface DeliveryStatusStepperProps {
  status: DeliveryStatus;
}

export function DeliveryStatusStepper({ status }: DeliveryStatusStepperProps) {
  const currentRank = STATUS_RANK[status] ?? 0;

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => {
        const stepRank = STATUS_RANK[step.key];
        const isCompleted = currentRank >= stepRank;
        const isCurrent =
          (step.key === 'accepted' && (status === 'accepted' || status === 'picking_up')) ||
          (step.key === 'picked_up' && (status === 'picked_up' || status === 'delivering')) ||
          (step.key === 'delivered' && status === 'delivered');
        const isLast = i === STEPS.length - 1;

        return (
          <View key={step.key}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.iconCircle,
                  isCompleted && styles.iconCircleActive,
                  isCurrent && styles.iconCircleCurrent,
                ]}
              >
                <Ionicons
                  name={step.icon as any}
                  size={18}
                  color={isCompleted ? colors.white : colors.textTertiary}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  isCompleted && styles.labelActive,
                  isCurrent && styles.labelCurrent,
                ]}
              >
                {step.label}
              </Text>
            </View>
            {!isLast ? (
              <View style={[styles.connector, isCompleted && styles.connectorActive]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconCircleCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    flex: 1,
  },
  labelActive: {
    color: colors.textPrimary,
  },
  labelCurrent: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  connector: {
    width: 2,
    height: 22,
    backgroundColor: colors.border,
    marginLeft: 17,
    marginVertical: 2,
  },
  connectorActive: {
    backgroundColor: colors.primary,
  },
});
