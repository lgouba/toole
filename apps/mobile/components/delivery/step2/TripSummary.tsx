import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { recap as R, step2 as T } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

interface Props {
  distanceKm: number;
  durationMin: number;
  priceXOF: number;
  visible: boolean;
}

/** Compteur JS qui monte de 0 → target en ~750ms (3 valeurs, coût négligeable). */
function useCountUp(target: number, run: boolean, ms = 750): number {
  const [val, setVal] = useState(run ? 0 : target);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!run) {
      setVal(target);
      return;
    }
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        setVal(target);
        return;
      }
      const start = Date.now();
      if (raf.current) clearInterval(raf.current);
      raf.current = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / ms);
        const eased = 1 - Math.pow(1 - t, 3);
        setVal(target * eased);
        if (t >= 1 && raf.current) {
          clearInterval(raf.current);
          raf.current = null;
          setVal(target);
        }
      }, 30);
    });
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, [target, run, ms]);
  return val;
}

export function TripSummary({ distanceKm, durationMin, priceXOF, visible }: Props) {
  const slide = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    slide.value = withTiming(visible ? 1 : 0, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [visible, slide]);

  const style = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateY: (1 - slide.value) * 24 }],
  }));

  const km = useCountUp(distanceKm, visible);
  const min = useCountUp(durationMin, visible);
  const price = useCountUp(priceXOF, visible);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.bar, style]} pointerEvents="none">
      <Cell label="DISTANCE" value={`${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`} />
      <View style={styles.sep} />
      <Cell label="DURÉE" value={`~${Math.round(min)} min`} />
      <View style={styles.sep} />
      <Cell label="ESTIMATION" value={formatCFA(Math.round(price))} highlight />
    </Animated.View>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, highlight && styles.cellValueHi]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.summaryBg,
    borderRadius: T.radius.summary,
    paddingVertical: R.space.lg,
    paddingHorizontal: R.space.gut,
    ...R.shadow.card,
  },
  cell: { flex: 1, alignItems: 'center', gap: 3 },
  cellLabel: { fontFamily: R.font.mono, fontSize: 9, letterSpacing: 1.3, color: 'rgba(255,255,255,0.55)' },
  cellValue: { fontFamily: R.font.mono, fontSize: 15, color: '#FFFFFF' },
  cellValueHi: { color: '#5BE584', fontSize: 16 },
  sep: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.14)' },
});
