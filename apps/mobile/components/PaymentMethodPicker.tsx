import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/theme';

export type ClientPaymentMethod = 'cash' | 'orange_money' | 'moov_money';

const OPTIONS: {
  key: ClientPaymentMethod;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  emoji?: string;
}[] = [
  {
    key: 'cash',
    label: 'Espèces à la livraison',
    hint: 'Vous payez directement au livreur',
    icon: 'cash-outline',
    color: '#16A34A',
    emoji: '💵',
  },
  {
    key: 'orange_money',
    label: 'Orange Money',
    hint: 'Paiement instantané via USSD',
    icon: 'phone-portrait-outline',
    color: '#FF6600',
    emoji: '🟠',
  },
  {
    key: 'moov_money',
    label: 'Moov Money',
    hint: 'Paiement instantané via USSD',
    icon: 'phone-portrait-outline',
    color: '#0066CC',
    emoji: '🔵',
  },
];

interface Props {
  value: ClientPaymentMethod;
  onChange: (m: ClientPaymentMethod) => void;
  amount?: number;
}

/**
 * Sélecteur du mode de paiement client.
 * - cash : par défaut, le livreur encaisse à la livraison.
 * - orange_money / moov_money : déclenche un flow USSD + OTP de confirmation.
 */
export function PaymentMethodPicker({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mode de paiement</Text>
      <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: opt.color + '20' },
                ]}
              >
                <Text style={{ fontSize: 18 }}>{opt.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{opt.label}</Text>
                <Text style={styles.hint}>{opt.hint}</Text>
              </View>
              <View
                style={[styles.radio, selected && styles.radioSelected]}
              >
                {selected ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
