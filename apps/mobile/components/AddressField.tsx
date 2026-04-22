import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { LatLng } from '@/types';

interface AddressFieldProps {
  variant: 'pickup' | 'delivery';
  address?: string;
  location?: LatLng | null;
}

/**
 * Affichage compact d'une adresse dans un formulaire. Au tap, ouvre l'ecran
 * plein ecran `/address-picker` pour saisir / modifier.
 */
export function AddressField({ variant, address, location }: AddressFieldProps) {
  const router = useRouter();
  const isPickup = variant === 'pickup';
  const isFilled = !!location;
  const color = isPickup ? colors.primary : colors.secondary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.background },
      ]}
      onPress={() => router.push(`/address-picker?type=${variant}`)}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>
          {isPickup ? 'Départ' : 'Arrivée'}
        </Text>
        <Text
          style={[
            styles.value,
            !isFilled && styles.valuePlaceholder,
          ]}
          numberOfLines={1}
        >
          {isFilled
            ? address || 'Position enregistrée'
            : isPickup
              ? 'Où récupérer le colis ?'
              : 'Où livrer le colis ?'}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  valuePlaceholder: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
});
