import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';

export type CancelReasonValue =
  | 'driver_unavailable'
  | 'driver_too_far'
  | 'package_issue'
  | 'recipient_unreachable'
  | 'other';

const DRIVER_REASONS: { value: CancelReasonValue; label: string; icon: string }[] = [
  {
    value: 'driver_unavailable',
    label: 'Imprevu personnel',
    icon: 'person-remove-outline',
  },
  {
    value: 'driver_too_far',
    label: 'Trop loin / trafic',
    icon: 'location-outline',
  },
  {
    value: 'package_issue',
    label: 'Problème avec le colis',
    icon: 'cube-outline',
  },
  {
    value: 'recipient_unreachable',
    label: 'Destinataire injoignable',
    icon: 'call-outline',
  },
  {
    value: 'other',
    label: 'Autre raison',
    icon: 'ellipsis-horizontal-outline',
  },
];

interface CancelReasonDialogProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onConfirm: (reason: CancelReasonValue, comment: string) => Promise<void> | void;
}

export function CancelReasonDialog({
  visible,
  title = 'Annuler la course',
  subtitle = 'Pourquoi annulez-vous ?',
  onClose,
  onConfirm,
}: CancelReasonDialogProps) {
  const [selected, setSelected] = useState<CancelReasonValue | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onConfirm(selected, comment.trim());
      setSelected(null);
      setComment('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            <View style={styles.reasons}>
              {DRIVER_REASONS.map((r) => {
                const isSelected = selected === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.reason, isSelected && styles.reasonSelected]}
                    onPress={() => setSelected(r.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={r.icon as any}
                      size={22}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}
                    >
                      {r.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.commentWrap}>
              <Input
                label="Commentaire (optionnel)"
                placeholder="Ajoutez un détail pour le client"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button title="Retour" variant="outline" onPress={onClose} style={styles.flex1} />
            <View style={{ width: 10 }} />
            <Button
              title="Confirmer"
              variant="danger"
              onPress={handleConfirm}
              disabled={!selected}
              loading={submitting}
              style={styles.flex1}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reasons: {
    gap: spacing.xs,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  reasonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  reasonLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  reasonLabelSelected: {
    fontWeight: '600',
    color: colors.primaryDark,
  },
  commentWrap: {
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  flex1: {
    flex: 1,
  },
});
