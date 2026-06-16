import React, { useEffect } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { driverHome as D } from '@/theme/recapTokens';

const SIZE = 178;

/** Anneau radar qui se propage (sonar) — visible uniquement en ligne. */
function Ping({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + v.value * 1.5 }],
    opacity: 0.5 * (1 - v.value),
  }));
  return <Animated.View style={[styles.ping, style]} pointerEvents="none" />;
}

export function IgnitionDial({
  online,
  disabled,
  onToggle,
}: {
  online: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  // Halo qui respire derrière le cadran (en ligne).
  const halo = useSharedValue(0);
  useEffect(() => {
    if (online) {
      halo.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      halo.value = withTiming(0, { duration: 300 });
    }
  }, [online, halo]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + halo.value * 0.3,
    transform: [{ scale: 1 + halo.value * 0.12 }],
  }));

  return (
    <View style={styles.wrap}>
      {online && (
        <>
          <Ping delay={0} />
          <Ping delay={700} />
          <Ping delay={1400} />
          <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
        </>
      )}

      <TouchableOpacity
        style={styles.dial}
        onPress={onToggle}
        disabled={disabled}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityState={{ selected: online, disabled }}
        accessibilityLabel={online ? 'Passer hors ligne' : 'Passer en ligne'}
      >
        <View style={[styles.core, online ? styles.coreOn : styles.coreOff, disabled && { opacity: 0.5 }]}>
          <MaterialIcons name="power-settings-new" size={34} color={online ? '#FFFFFF' : '#7C786E'} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ping: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: D.ping,
  },
  halo: {
    position: 'absolute',
    width: SIZE - 10,
    height: SIZE - 10,
    borderRadius: SIZE / 2,
    backgroundColor: D.halo,
  },
  dial: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 6,
    borderColor: '#F1ECE0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#503C0A',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  core: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreOff: { backgroundColor: '#EFEBE1' },
  coreOn: {
    backgroundColor: D.green,
    shadowColor: D.green,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
