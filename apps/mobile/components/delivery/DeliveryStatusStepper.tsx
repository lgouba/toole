import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/theme';
import { DeliveryStatus } from '@/types';

const STEPS: { key: DeliveryStatus; label: string; icon: string }[] = [
  { key: 'accepted', label: 'Livreur assigne', icon: 'checkmark-circle' },
  { key: 'picking_up', label: 'En route (recuperation)', icon: 'bicycle' },
  { key: 'picked_up', label: 'Colis recupere', icon: 'camera' },
  { key: 'delivering', label: 'En cours de livraison', icon: 'navigate' },
  { key: 'delivered', label: 'Livre', icon: 'checkmark-done-circle' },
];

const STATUS_ORDER: DeliveryStatus[] = [
  'pending', 'accepted', 'picking_up', 'picked_up', 'delivering', 'delivered',
];

interface DeliveryStatusStepperProps {
  status: DeliveryStatus;
}

export function DeliveryStatusStepper({ status }: DeliveryStatusStepperProps) {
  const currentIndex = STATUS_ORDER.indexOf(status);

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => {
        const stepIndex = STATUS_ORDER.indexOf(step.key);
        const isCompleted = currentIndex >= stepIndex;
        const isCurrent = status === step.key;
        const isLast = i === STEPS.length - 1;

        return (
          <View key={step.key}>
            <View style={styles.stepRow}>
              <View style={[styles.iconCircle, isCompleted && styles.iconCircleActive]}>
                <Ionicons
                  name={step.icon as any}
                  size={18}
                  color={isCompleted ? colors.white : colors.textTertiary}
                />
              </View>
              <Text style={[styles.label, isCompleted && styles.labelActive, isCurrent && styles.labelCurrent]}>
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View style={[styles.connector, isCompleted && styles.connectorActive]} />
            )}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  labelActive: {
    color: colors.textPrimary,
  },
  labelCurrent: {
    fontWeight: '600',
  },
  connector: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 15,
    marginVertical: 2,
  },
  connectorActive: {
    backgroundColor: colors.primary,
  },
});
