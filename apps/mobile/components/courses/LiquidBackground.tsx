import React from 'react';
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
import { useEffect } from 'react';

/**
 * Fond « Crème & vert profond » de la modale Nouvelle course.
 *
 * Un liquide vert plein largeur dont SEULE la hauteur est animée : il se retire
 * au fil du compte à rebours et découvre le papier crème. La hauteur est
 * pilotée par le `progress` EXISTANT (0 = plein, 1 = expiré) — aucune logique
 * métier ici, juste du rendu sur le thread UI.
 *
 * niveau = plancher + (1 - progress) × (hauteurÉcran - plancher)
 */

const WAVE_W = 780;

// Tracés statiques (on n'anime JAMAIS l'attribut `d`, seulement une translation).
const WAVE1 = 'M0 13 Q 48 0 97 13 T 195 13 T 292 13 T 390 13 T 487 13 T 585 13 T 682 13 T 780 13 L780 26 L0 26 Z';
const WAVE2 = 'M0 11 Q 60 22 120 11 T 240 11 T 360 11 T 480 11 T 600 11 T 720 11 T 780 11 L780 22 L0 22 Z';

const BUBBLES = Array.from({ length: 7 }, (_, i) => ({
  x: 24 + i * 50,
  size: 5 + ((i * 3) % 9),
  dur: 7000 + (i % 4) * 900,
  phase: i / 7,
}));

export function LiquidBackground({
  progress,
  reduceMotion,
  floor,
  height,
  width,
}: {
  progress: SharedValue<number>;
  reduceMotion: boolean;
  floor: number;
  height: number;
  width: number;
}) {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const bubbleT = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    wave1.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    wave2.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    bubbleT.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Hauteur du liquide (= position Y de la surface).
  const liquidStyle = useAnimatedStyle(() => ({
    height: floor + (1 - progress.value) * (height - floor),
  }));
  // Conteneur des vagues : suit la surface (bas du liquide), à cheval dessus.
  const waveWrapStyle = useAnimatedStyle(() => ({
    top: floor + (1 - progress.value) * (height - floor) - 13,
  }));
  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(wave1.value, [0, 1], [0, -390]) }],
  }));
  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(wave2.value, [0, 1], [0, 390]) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Fond crème (toujours plein écran, révélé quand le liquide se retire) */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FDFBF5" />
            <Stop offset="1" stopColor="#F3EFE3" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#cream)" />
      </Svg>

      {/* Le liquide (hauteur animée) */}
      <Animated.View style={[styles.liquid, liquidStyle]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#189B5A" />
              <Stop offset="0.34" stopColor="#0E7A44" />
              <Stop offset="0.74" stopColor="#0A5C33" />
              <Stop offset="1" stopColor="#074526" />
            </LinearGradient>
            <RadialGradient id="veil" cx="0.2" cy="0.15" r="0.6">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.26" />
              <Stop offset="0.66" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="url(#liquid)" />
          <Ellipse cx={width * 0.2 - 70} cy={-30 + 105} rx={220} ry={105} fill="url(#veil)" />
        </Svg>

        {/* Bulles (dans le liquide, coupées par overflow hidden) */}
        {!reduceMotion &&
          BUBBLES.map((b, i) => (
            <Bubble key={i} b={b} t={bubbleT} liquidHeight={floor + (height - floor)} />
          ))}

        {/* Ménisque : ligne blanche collée sous la surface (bas du liquide) */}
        <View style={styles.meniscus} />
      </Animated.View>

      {/* Vagues : à cheval sur la surface, translation horizontale en boucle */}
      {!reduceMotion && (
        <Animated.View style={[styles.waveWrap, { width }, waveWrapStyle]}>
          <Animated.View style={[styles.wave, wave2Style]}>
            <Svg width={WAVE_W} height={22} viewBox="0 0 780 22" preserveAspectRatio="none">
              <Path d={WAVE2} fill="rgba(255,255,255,0.13)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.wave, wave1Style]}>
            <Svg width={WAVE_W} height={26} viewBox="0 0 780 26" preserveAspectRatio="none">
              <Path d={WAVE1} fill="rgba(255,255,255,0.20)" />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

function Bubble({
  b,
  t,
  liquidHeight,
}: {
  b: { x: number; size: number; dur: number; phase: number };
  t: SharedValue<number>;
  liquidHeight: number;
}) {
  const style = useAnimatedStyle(() => {
    // Progression propre à la bulle (phase décalée), bornée [0,1].
    const p = (t.value + b.phase) % 1;
    const rise = 300;
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [0, -rise]) },
        { scale: interpolate(p, [0, 1], [0.7, 1.1]) },
      ],
      opacity: interpolate(p, [0, 0.12, 1], [0, 0.5, 0]),
    };
  });
  return (
    <Animated.View
      style={[
        styles.bubble,
        { left: b.x, width: b.size, height: b.size, borderRadius: b.size / 2, top: liquidHeight - 40 },
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
  meniscus: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  waveWrap: { position: 'absolute', left: 0, height: 26 },
  wave: { position: 'absolute', left: 0, top: 0 },
  bubble: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.4)' },
});
