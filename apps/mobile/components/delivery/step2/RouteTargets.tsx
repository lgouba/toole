import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { recap as R, step2 as T } from '@/theme/recapTokens';
import { Which } from './tripTypes';

interface Props {
  pickupLabel?: string | null;
  dropoffLabel?: string | null;
  active: Which;
  onSelect: (w: Which) => void;
  /** Incrémenté quand une valeur vient d'être posée → flash vert. */
  flash?: Which | null;
}

export function RouteTargets({ pickupLabel, dropoffLabel, active, onSelect, flash }: Props) {
  return (
    <View style={styles.card}>
      <Row
        which="pickup"
        labelCaps="DÉPART"
        capsColor={T.green}
        value={pickupLabel}
        placeholder="Où récupérer le colis ?"
        active={active === 'pickup'}
        flashOn={flash === 'pickup'}
        onPress={() => onSelect('pickup')}
        dot="round"
      />

      <View style={styles.dashRow}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </View>

      <Row
        which="dropoff"
        labelCaps="ARRIVÉE"
        capsColor={T.textMuted}
        value={dropoffLabel}
        placeholder="Où livrer le colis ?"
        active={active === 'dropoff'}
        flashOn={flash === 'dropoff'}
        onPress={() => onSelect('dropoff')}
        dot="square"
      />
    </View>
  );
}

function Row({
  labelCaps,
  capsColor,
  value,
  placeholder,
  active,
  flashOn,
  onPress,
  dot,
}: {
  which: Which;
  labelCaps: string;
  capsColor: string;
  value?: string | null;
  placeholder: string;
  active: boolean;
  flashOn?: boolean;
  onPress: () => void;
  dot: 'round' | 'square';
}) {
  // Pulse du point quand la ligne est active.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [active, pulse]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.22,
    transform: [{ scale: 1 + pulse.value * 0.5 }],
  }));

  // Flash vert de la valeur quand elle vient d'être posée.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (flashOn) {
      flash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 480 }));
    }
  }, [flashOn, value, flash]);
  const valueStyle = useAnimatedStyle(() => ({
    color: flash.value > 0.5 ? T.green : value ? T.textPrim : T.textMuted,
  }));

  return (
    <TouchableOpacity
      style={[styles.row, active && styles.rowActive]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${labelCaps}, ${value || placeholder}`}
    >
      <View style={styles.dotCol}>
        {active && (
          <Animated.View
            style={[styles.halo, dot === 'square' && styles.haloSquare, haloStyle]}
          />
        )}
        <View
          style={[
            styles.dot,
            dot === 'square' ? styles.dotSquare : styles.dotRound,
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.caps, { color: capsColor }]}>{labelCaps}</Text>
        <Animated.Text style={[styles.value, valueStyle]} numberOfLines={1}>
          {value || placeholder}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: R.space.sm,
    ...R.shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.lg,
    paddingVertical: R.space.md,
    paddingHorizontal: R.space.md,
    borderRadius: T.radius.row,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowActive: { backgroundColor: T.activeBg, borderColor: T.activeRing },
  dotCol: { width: 22, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.green,
  },
  haloSquare: { borderRadius: 6 },
  dot: { width: 13, height: 13 },
  dotRound: { borderRadius: 7, backgroundColor: T.dotPickup },
  dotSquare: { borderRadius: 3, backgroundColor: T.dotDropoff },
  caps: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  value: { fontFamily: R.font.bodyBold, fontSize: 14.5 },
  dashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: R.space.gut,
    paddingVertical: 2,
  },
  dash: { width: 6, height: 2, borderRadius: 1, backgroundColor: T.border },
});
