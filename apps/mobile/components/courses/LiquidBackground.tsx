import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Ellipse } from 'react-native-svg';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

/**
 * Fond « Crème & vert profond ». Un liquide vert plein largeur dont SEULE la
 * hauteur est animée, entre PLANCHER (juste sous les tuiles) et PLAFOND (haut
 * de la carte). Piloté par le `progress` EXISTANT (0 = plein → 1 = expiré).
 *
 *   hauteur = plancher + (1 - progress) × (plafond - plancher)
 *
 * Le haut reste toujours vert (gain blanc lisible), le bas toujours crème
 * (curseur + refus lisibles). Aucune logique métier ici.
 */

const WAVE_W = 780;
const WAVE1 = 'M0 13 Q 48 0 97 13 T 195 13 T 292 13 T 390 13 T 487 13 T 585 13 T 682 13 T 780 13 L780 26 L0 26 Z';
const WAVE2 = 'M0 11 Q 60 22 120 11 T 240 11 T 360 11 T 480 11 T 600 11 T 720 11 T 780 11 L780 22 L0 22 Z';

// x = 34 + i×60 ; d = 5 + (i mod 3)×4 ; dur = 7+(i mod 4)s ; delai = (i×1.6)%9
const BUBBLES = Array.from({ length: 6 }, (_, i) => ({
  x: 34 + i * 60,
  size: 5 + (i % 3) * 4,
  phase: ((i * 1.6) % 9) / 9,
}));

export function LiquidBackground({
  progress,
  reduceMotion,
  plancher,
  plafond,
  width,
}: {
  progress: SharedValue<number>;
  reduceMotion: boolean;
  plancher: number;
  plafond: number;
  width: number;
}) {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const bubbleT = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    wave1.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    wave2.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    bubbleT.value = withRepeat(withTiming(1, { duration: 4400, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // hauteur du liquide = position Y de la surface. On INLINE le calcul dans
  // chaque worklet : appeler une fonction JS normale depuis un worklet crashe
  // le thread UI (New Architecture). plancher/plafond sont des nombres capturés,
  // donc utilisables tels quels dans le worklet.
  const liquidStyle = useAnimatedStyle(() => ({
    height: plancher + (1 - progress.value) * (plafond - plancher),
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    top: plancher + (1 - progress.value) * (plafond - plancher),
  }));
  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(wave1.value, [0, 1], [0, -390]) }],
  }));
  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(wave2.value, [0, 1], [0, 390]) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Fond crème (révélé quand le liquide se retire) */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FDFBF5" />
            <Stop offset="1" stopColor="#F3EFE3" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={plafond + 400} fill="url(#cream)" />
      </Svg>

      {/* Liquide (hauteur animée) */}
      <Animated.View style={[styles.liquid, liquidStyle]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#189B5A" />
              <Stop offset="0.34" stopColor="#0E7A44" />
              <Stop offset="0.74" stopColor="#0A5C33" />
              <Stop offset="1" stopColor="#074526" />
            </LinearGradient>
            <RadialGradient id="veil" cx="0.16" cy="0.16" r="0.7">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.26" />
              <Stop offset="0.66" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={plafond} fill="url(#liquid)" />
          <Ellipse cx={width * 0.16 - 70} cy={75} rx={220} ry={105} fill="url(#veil)" />
        </Svg>

        {!reduceMotion &&
          BUBBLES.map((b, i) => <Bubble key={i} b={b} t={bubbleT} baseTop={plafond} />)}
      </Animated.View>

      {/* Surface : ménisque + halo + vagues, suit le niveau */}
      <Animated.View style={[styles.surface, { width }, surfaceStyle]} pointerEvents="none">
        {/* halo sous la surface (sur le crème) */}
        <Svg style={styles.halo} width={width} height={90}>
          <Defs>
            <LinearGradient id="uhalo" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
              <Stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={90} fill="url(#uhalo)" />
        </Svg>
        {/* ménisque à hauteur - 2 */}
        <View style={styles.meniscus} />
        {/* vagues à cheval sur la surface */}
        {!reduceMotion && (
          <>
            <Animated.View style={[styles.wave, { top: -8 }, wave2Style]}>
              <Svg width={WAVE_W} height={22} viewBox="0 0 780 22" preserveAspectRatio="none">
                <Path d={WAVE2} fill="rgba(255,255,255,0.17)" />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.wave, { top: -13 }, wave1Style]}>
              <Svg width={WAVE_W} height={26} viewBox="0 0 780 26" preserveAspectRatio="none">
                <Path d={WAVE1} fill="rgba(255,255,255,0.26)" />
              </Svg>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function Bubble({
  b,
  t,
  baseTop,
}: {
  b: { x: number; size: number; phase: number };
  t: SharedValue<number>;
  baseTop: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = (t.value + b.phase) % 1;
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [0, -260]) },
        { scale: interpolate(p, [0, 1], [0.7, 1.1]) },
      ],
      opacity: interpolate(p, [0, 0.14, 1], [0, 0.5, 0]),
    };
  });
  return (
    <Animated.View
      style={[
        styles.bubble,
        { left: b.x, width: b.size, height: b.size, borderRadius: b.size / 2, top: baseTop - 30 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  liquid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: '#0A5C33',
  },
  surface: { position: 'absolute', left: 0, height: 0 },
  halo: { position: 'absolute', left: 0, top: 0 },
  meniscus: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -2,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  wave: { position: 'absolute', left: 0 },
  bubble: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.4)' },
});
