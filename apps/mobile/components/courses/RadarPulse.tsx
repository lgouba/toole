import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { T } from './theme';

const SIZE = 210;

function Ring({ delay, reduceMotion }: { delay: number; reduceMotion: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(v.value, [0, 1], [0.25, 1]) }],
    opacity: interpolate(v.value, [0, 1], [0.9, 0]),
  }));

  return <Animated.View style={[styles.ring, style]} />;
}

/** 3 anneaux radar qui s'étendent en boucle, décalés. Décor derrière le gain. */
export function RadarPulse({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Ring delay={0} reduceMotion={reduceMotion} />
      <Ring delay={1000} reduceMotion={reduceMotion} />
      <Ring delay={2000} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: T.vivid,
    opacity: 0.5,
  },
});
