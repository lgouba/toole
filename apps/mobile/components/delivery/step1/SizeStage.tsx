import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { recap as R, step1 as S } from '@/theme/recapTokens';
import { PackageSize } from '@/types';
import { BagHero } from './BagHero';

interface Props {
  value: PackageSize;
  onChange: (s: PackageSize) => void;
}

const SIZES = S.sizes;

/** Scène héro : sac Toolé rotatif (sans ombre au sol) + segmenté + readout. */
export function SizeStage({ value, onChange }: Props) {
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const sceneH = compact ? 120 : 138;

  const meta = SIZES.find((s) => s.key === value) ?? SIZES[1];

  return (
    <View style={[styles.stage, { borderRadius: S.radius.stage }]}>
      <Text style={styles.eyebrow}>ÉTAPE 1 · VOTRE COLIS</Text>

      <View style={[styles.scene, { height: sceneH }]}>
        <BagHero size={value} />
      </View>

      <View style={styles.readout}>
        <Text style={styles.readName}>{meta.name}</Text>
        <Text style={styles.readWeight}>{meta.weight}</Text>
      </View>

      <View style={styles.segment}>
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
    paddingTop: R.space.md,
    paddingBottom: R.space.lg,
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
    marginTop: R.space.xs,
  },
  readout: { alignItems: 'center', marginTop: R.space.sm, gap: 1 },
  readName: { fontFamily: R.font.displayXBold, fontSize: 19, color: S.textPrim },
  readWeight: { fontFamily: R.font.mono, fontSize: 12, color: S.textSec },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: R.radius.pill,
    padding: 4,
    marginTop: R.space.md,
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
