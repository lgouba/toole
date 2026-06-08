import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { T } from './theme';

/**
 * Fond plein écran : dégradé radial (centre-haut clair → bas très sombre) +
 * 2 orbes verts diffus qui dérivent lentement. RN ne fait pas de radial en CSS
 * → on passe par react-native-svg.
 */
export function MissionBackground({ reduceMotion }: { reduceMotion: boolean }) {
  const { width, height } = useWindowDimensions();

  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    a.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }), -1, true);
    b.value = withRepeat(withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion]);

  const orbA = useAnimatedStyle(() => ({
    transform: [{ translateX: a.value * 40 }, { translateY: a.value * 30 }],
  }));
  const orbB = useAnimatedStyle(() => ({
    transform: [{ translateX: -b.value * 30 }, { translateY: b.value * 40 }],
  }));

  return (
    <>
      {/* Dégradé radial de fond */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="0%" r="130%">
            <Stop offset="0" stopColor={T.bgTop} />
            <Stop offset="0.38" stopColor={T.bgMid} />
            <Stop offset="0.7" stopColor={T.bgLow} />
            <Stop offset="1" stopColor={T.bgEnd} />
          </RadialGradient>
          {/* orbe = dégradé couleur → transparent (simule le flou sans coût) */}
          <RadialGradient id="orbA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={T.vivid} stopOpacity="0.45" />
            <Stop offset="1" stopColor={T.vivid} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="orbB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#19C97A" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#19C97A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />
      </Svg>

      {/* Orbes animés */}
      <Animated.View style={[styles.orb, { top: -40, left: -50 }, orbA]} pointerEvents="none">
        <Svg width={230} height={230}>
          <Circle cx={115} cy={115} r={115} fill="url(#orbA)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.orb, { bottom: -30, right: -40 }, orbB]}
        pointerEvents="none"
      >
        <Svg width={190} height={190}>
          <Circle cx={95} cy={95} r={95} fill="url(#orbB)" />
        </Svg>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute' },
});
