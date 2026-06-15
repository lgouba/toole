import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, step4 as S } from '@/theme/recapTokens';

interface Props {
  title: string;
  subtitle: string;
  /** 'cash' = icône verte ; sinon rond plein couleur opérateur (sans logo). */
  variant: 'cash' | 'orange' | 'moov';
  selected: boolean;
  onPress: () => void;
}

export function MethodCard({ title, subtitle, variant, selected, onPress }: Props) {
  const color = variant === 'cash' ? S.cashFg : variant === 'orange' ? S.orange : S.moov;
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.icon,
          variant === 'cash' ? { backgroundColor: S.cashBg } : { backgroundColor: color },
        ]}
      >
        {variant === 'cash' ? (
          <MaterialIcons name="payments" size={20} color={S.cashFg} />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    backgroundColor: S.surface,
    borderRadius: S.radius.method,
    borderWidth: 1.5,
    borderColor: S.border,
    padding: R.space.lg,
  },
  cardSelected: { borderColor: S.green, backgroundColor: S.activeBg },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: R.font.bodyBold, fontSize: 14.5, color: S.textPrim },
  subtitle: { fontFamily: R.font.body, fontSize: 12, color: S.textMuted, marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: S.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: S.green },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: S.green },
});
