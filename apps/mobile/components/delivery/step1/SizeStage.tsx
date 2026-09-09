import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { recap as R, step1 as S } from '@/theme/recapTokens';
import { PackageSize } from '@/types';
import { ParcelScene } from './ParcelScene';

interface Props {
  value: PackageSize;
  onChange: (s: PackageSize) => void;
}

const SIZES = S.sizes;

/** Scène : 3 cartons isométriques côte à côte + readout + segmenté. */
export function SizeStage({ value, onChange }: Props) {
  const meta = SIZES.find((s) => s.key === value) ?? SIZES[1];

  return (
    <View style={[styles.stage, { borderRadius: S.radius.stage }]}>
      <Text style={styles.eyebrow}>ÉTAPE 1 · VOTRE COLIS</Text>

      <ParcelScene value={value} onChange={onChange} sizes={SIZES} />

      <View style={styles.readout}>
        <Text style={styles.readName}>{meta.name}</Text>
        <Text style={styles.readWeight}>{meta.weight}</Text>
      </View>

      {/* Segmenté : masqué de l'arbre a11y (le radiogroup des cartons est le
          contrôle exposé) -> le lecteur d'écran annonce 3 options, pas 6. */}
      <View style={styles.segment} importantForAccessibility="no-hide-descendants">
        {SIZES.map((s) => {
          const active = s.key === value;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.segItem, active && styles.segItemActive]}
              onPress={() => onChange(s.key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.name}, ${s.weight}`}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{s.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: S.stageBg,
    borderWidth: 1,
    borderColor: S.stageTint,
    paddingTop: R.space.sm,
    paddingBottom: R.space.md,
    paddingHorizontal: R.space.gut,
    ...R.shadow.card,
  },
  eyebrow: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: S.green,
    textAlign: 'center',
  },
  scene: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  readout: { alignItems: 'center', marginTop: R.space.xs, gap: 1 },
  readName: { fontFamily: R.font.displayXBold, fontSize: 19, color: S.textPrim },
  readWeight: { fontFamily: R.font.mono, fontSize: 12, color: S.textSec },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: R.radius.pill,
    padding: 4,
    marginTop: R.space.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: S.border,
  },
  segItem: {
    flex: 1,
    paddingVertical: R.space.sm,
    borderRadius: R.radius.pill,
    alignItems: 'center',
  },
  segItemActive: {
    backgroundColor: S.green,
    shadowColor: S.green,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  segText: { fontFamily: R.font.bodyBold, fontSize: 14, color: S.textSec },
  segTextActive: { color: '#FFFFFF' },
});
