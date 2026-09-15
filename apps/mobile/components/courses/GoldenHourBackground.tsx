import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';

/**
 * Moteur « L'heure dorée » : le rebours ne se lit pas, il se voit. Ciel + sol +
 * soleil + étoiles passent du plein jour à la nuit selon `u` (0=jour, 1=nuit),
 * le soleil descend selon `p` (1=plein temps, 0=perdu). Tout sur le thread UI.
 * La ligne d'horizon = `horizon` (= haut de la carte), passée par le parent.
 */

const STARS = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 61) % 100, // %
  y: (i * 37) % 33, // % (tiers supérieur)
  size: 1.6 + (i % 3) * 0.4,
  phase: (i * 0.13) % 1,
}));

export function GoldenHourBackground({
  u,
  uSol,
  p,
  horizon,
  sunTop,
  sunBottom,
  sunSize,
  width,
  height,
  reduceMotion,
}: {
  u: SharedValue<number>;
  uSol: SharedValue<number>;
  p: SharedValue<number>;
  horizon: number;
  sunTop: number;
  sunBottom: number;
  sunSize: number;
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  const tw = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    tw.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const nightSkyStyle = useAnimatedStyle(() => ({ opacity: u.value }));
  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sunBottom - p.value * (sunBottom - sunTop) }],
  }));
  const nightSunStyle = useAnimatedStyle(() => ({ opacity: u.value }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * (1 - p.value) }));
  const nightHaloStyle = useAnimatedStyle(() => ({ opacity: u.value }));
  const starsStyle = useAnimatedStyle(() => ({ opacity: 0.2 + 0.8 * u.value }));
  // Sol : progression PROPRE (uSol, décalée), milieu SABLE clair (pas brun,
  // pas gris) → deux segments 0→0.5→1.
  const groundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      uSol.value,
      [0, 0.5, 1],
      ['#F2E9D8', '#CAAE8C', '#0B0E0E'],
    ),
  }));

  const haloH = 220;
  const OVER = 240; // débordement bas pour couvrir la barre de navigation

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Ciel JOUR (plein écran) */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#03140E" />
            <Stop offset="0.24" stopColor="#062A1C" />
            <Stop offset="0.48" stopColor="#0A4A2F" />
            <Stop offset="0.68" stopColor="#176E3E" />
            <Stop offset="0.85" stopColor="#7E8A34" />
            <Stop offset="1" stopColor="#E5A63C" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height + OVER} fill="url(#skyDay)" />
      </Svg>
      {/* Ciel NUIT (crossfade, opacité = u) */}
      <Animated.View style={[StyleSheet.absoluteFill, nightSkyStyle]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#010508" />
              <Stop offset="0.24" stopColor="#020C0C" />
              <Stop offset="0.48" stopColor="#041A18" />
              <Stop offset="0.68" stopColor="#082824" />
              <Stop offset="0.85" stopColor="#1A2422" />
              <Stop offset="1" stopColor="#4A2A1A" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height + OVER} fill="url(#skyNight)" />
        </Svg>
      </Animated.View>

      {/* Étoiles (tiers supérieur) */}
      <Animated.View style={[StyleSheet.absoluteFill, starsStyle]} pointerEvents="none">
        {STARS.map((s, i) => (
          <Star key={i} s={s} tw={tw} reduceMotion={reduceMotion} skyH={horizon} width={width} />
        ))}
      </Animated.View>

      {/* Soleil (descend ; le sol le recouvre) */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0.6 * width, width: sunSize, height: sunSize },
          sunStyle,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.sunGlow, { borderRadius: sunSize / 2 }]} />
        <Svg width={sunSize} height={sunSize}>
          <Defs>
            <RadialGradient id="sunDay" cx="0.42" cy="0.36" r="0.6">
              <Stop offset="0" stopColor="#FFF6DA" />
              <Stop offset="0.36" stopColor="#FFD880" />
              <Stop offset="0.68" stopColor="#F3A93C" />
              <Stop offset="1" stopColor="#DF8328" />
            </RadialGradient>
          </Defs>
          <Circle cx={sunSize / 2} cy={sunSize / 2} r={sunSize / 2} fill="url(#sunDay)" />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, nightSunStyle]}>
          <Svg width={sunSize} height={sunSize}>
            <Defs>
              <RadialGradient id="sunNight" cx="0.42" cy="0.36" r="0.6">
                <Stop offset="0" stopColor="#FFE2B2" />
                <Stop offset="0.36" stopColor="#FFA456" />
                <Stop offset="0.68" stopColor="#E8682C" />
                <Stop offset="1" stopColor="#BA3A1A" />
              </RadialGradient>
            </Defs>
            <Circle cx={sunSize / 2} cy={sunSize / 2} r={sunSize / 2} fill="url(#sunNight)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Sol (au-dessus du soleil → coucher sans masque) */}
      <Animated.View
        style={[{ position: 'absolute', left: 0, right: 0, top: horizon, height: height - horizon + OVER }, groundStyle]}
      />

      {/* Halo d'horizon (sur le sol, intensité suit p) */}
      <Animated.View
        style={[
          { position: 'absolute', left: -width * 0.22, width: width * 1.44, top: horizon - haloH / 2, height: haloH },
          haloStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width={width * 1.44} height={haloH}>
          <Defs>
            <RadialGradient id="haloDay" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#FFC466" stopOpacity="0.8" />
              <Stop offset="0.73" stopColor="#FFC466" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width * 1.44} height={haloH} fill="url(#haloDay)" />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, nightHaloStyle]}>
          <Svg width={width * 1.44} height={haloH}>
            <Defs>
              <RadialGradient id="haloNight" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor="#FF702C" stopOpacity="0.42" />
                <Stop offset="0.73" stopColor="#FF702C" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={width * 1.44} height={haloH} fill="url(#haloNight)" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Star({
  s,
  tw,
  reduceMotion,
  skyH,
  width,
}: {
  s: { x: number; y: number; size: number; phase: number };
  tw: SharedValue<number>;
  reduceMotion: boolean;
  skyH: number;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.7 };
    const ph = (tw.value + s.phase) % 1;
    return { opacity: interpolate(ph, [0, 0.5, 1], [0.22, 0.95, 0.22]) };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (s.x / 100) * width,
          top: (s.y / 100) * skyH,
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: '#FFFFFF',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  sunGlow: {
    backgroundColor: 'transparent',
    shadowColor: '#FFB347',
    shadowOpacity: 0.5,
    shadowRadius: 46,
    shadowOffset: { width: 0, height: 0 },
  },
});
