import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { recap as R, step1 as S } from '@/theme/recapTokens';
import { PackageSize } from '@/types';
import { ParcelBox } from './ParcelBox';

interface Props {
  value: PackageSize;
  onChange: (s: PackageSize) => void;
}

const SIZES = S.sizes;

/** Scène héro : carton kraft qui grandit/rétrécit (spring) + segmenté + readout. */
export function SizeStage({ value, onChange }: Props) {
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const stageH = compact ? 96 : 122;
  const boxBase = compact ? 92 : 116;

  const meta = SIZES.find((s) => s.key === value) ?? SIZES[1];
  const scale = useSharedValue(meta.scale);

  useEffect(() => {
    scale.value = withSpring(meta.scale, { damping: 12, stiffness: 180, mass: 0.6 });
  }, [meta.scale, scale]);

  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.55 + scale.value * 0.55 }],
    opacity: 0.1 + scale.value * 0.14,
  }));

  return (
    <View style={[styles.stage, { borderRadius: S.radius.stage }]}>
      <Text style={styles.eyebrow}>ÉTAPE 1 · VOTRE COLIS</Text>

      <View style={[styles.scene, { height: stageH }]}>
        <Animated.View style={[styles.groundShadow, shadowStyle]} />
        <Animated.View style={[styles.boxWrap, boxStyle]}>
          <ParcelBox size={boxBase} />
        </Animated.View>
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
    paddingTop: R.space.lg,
    paddingBottom: R.space.gut,
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
    justifyContent: 'flex-end',
    marginTop: R.space.sm,
  },
  boxWrap: { transformOrigin: 'center bottom' },
  groundShadow: {
    position: 'absolute',
    bottom: 4,
    width: 90,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1A1A17',
    alignSelf: 'center',
  },
  readout: { alignItems: 'center', marginTop: R.space.md, gap: 2 },
  readName: { fontFamily: R.font.displayXBold, fontSize: 20, color: S.textPrim },
  readWeight: { fontFamily: R.font.mono, fontSize: 12, color: S.textSec },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: R.radius.pill,
    padding: 4,
    marginTop: R.space.lg,
    gap: 4,
    borderWidth: 1,
    borderColor: S.border,
  },
  segItem: {
    flex: 1,
    paddingVertical: R.space.md,
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
