import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, step3 as S } from '@/theme/recapTokens';

interface Props {
  value: boolean;
  onChange: (b: boolean) => void;
}

/** Carte-bascule "Quelqu'un d'autre détient le colis" (thème, plus de jaune criard). */
export function HeldByOtherToggle({ value, onChange }: Props) {
  const c = value ? S.toggleActive : S.toggleIdle;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}
      onPress={() => onChange(!value)}
      activeOpacity={0.9}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.icon, { backgroundColor: c.fg + '1F' }]}>
        <MaterialIcons name="person-pin-circle" size={22} color={c.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Quelqu'un d'autre détient le colis</Text>
        <Text style={styles.desc}>
          Si le colis n'est pas chez toi (ami, boutique…), le livreur contactera
          cette personne pour le récupérer.
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: S.border, true: S.green }}
        thumbColor="#FFFFFF"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    padding: R.space.lg,
    borderRadius: S.radius.toggle,
    borderWidth: 1.5,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: R.font.bodyBold, fontSize: 14, color: S.textPrim },
  desc: { fontFamily: R.font.body, fontSize: 11.5, color: S.textSec, marginTop: 2, lineHeight: 16 },
});
