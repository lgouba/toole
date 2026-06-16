import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, profile as P } from '@/theme/recapTokens';

export interface MenuEntry {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: keyof typeof P.tint;
  label: string;
  onPress: () => void;
  /** Sous-libellé optionnel (ex. « Orange ···12 »). */
  sub?: string;
  /** Chip de statut optionnel à droite (ex. documents « À jour »). */
  chip?: { label: string; tone: keyof typeof P.chip };
}

/** Section de menu : libellé caps + carte blanche de lignes (icône teintée + chevron). */
export function MenuSection({ title, items }: { title: string; items: MenuEntry[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>
        {items.map((it, i) => (
          <TouchableOpacity
            key={it.label}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
            onPress={it.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={[styles.chip, { backgroundColor: P.tint[it.tint] }]}>
              <MaterialIcons name={it.icon} size={20} color={tintFg(it.tint)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{it.label}</Text>
              {it.sub ? <Text style={styles.sub}>{it.sub}</Text> : null}
            </View>
            {it.chip ? (
              <View style={[styles.statusChip, { backgroundColor: P.chip[it.chip.tone].bg }]}>
                <Text style={[styles.statusChipText, { color: P.chip[it.chip.tone].fg }]}>
                  {it.chip.label}
                </Text>
              </View>
            ) : null}
            <MaterialIcons name="chevron-right" size={22} color={P.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function tintFg(t: keyof typeof P.tint): string {
  switch (t) {
    case 'green': return '#15803D';
    case 'blue': return '#2C7CC2';
    case 'amber': return '#C5961A';
    case 'violet': return '#7E55E6';
    default: return '#6B6356';
  }
}

const styles = StyleSheet.create({
  section: { marginBottom: R.space.gut },
  sectionLabel: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: P.textMuted,
    marginBottom: R.space.sm,
    marginLeft: R.space.xs,
  },
  card: {
    backgroundColor: P.surface,
    borderRadius: P.radius.card,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    paddingVertical: R.space.lg,
    paddingHorizontal: R.space.lg,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: P.divider },
  chip: {
    width: 38,
    height: 38,
    borderRadius: P.radius.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: R.font.bodyBold, fontSize: 15, color: P.textPrim },
  sub: { fontFamily: R.font.body, fontSize: 12, color: P.textMuted, marginTop: 2 },
  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusChipText: { fontFamily: R.font.bodyBold, fontSize: 11 },
});
