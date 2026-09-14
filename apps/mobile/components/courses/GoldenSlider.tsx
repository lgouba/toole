import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withRepeat,
  interpolate,
  interpolateColor,
  runOnJS,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FONT } from './theme';
import { alertConfirmSuccess, alertTap } from '@/utils/alerts';

/**
 * Glisser-pour-accepter « L'heure dorée ». Le GESTE est identique à
 * SlideToAccept (copié verbatim) — seul l'habillage change : dégradé or→braise
 * qui suit la lumière `u` (0=jour, 1=nuit), deux lignes de texte, balayage.
 * Le battement/halo est géré par le parent (wrapper), pas ici.
 */
const MARGIN = 6;

export function GoldenSlider({
  label,
  subLabel,
  onAccept,
  reduceMotion,
  u,
  height,
}: {
  label: string;
  subLabel: string;
  onAccept: () => void;
  reduceMotion: boolean;
  u: SharedValue<number>;
  height: number;
}) {
  const knob = height - 12;
  const [trackW, setTrackW] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const tickedMid = useSharedValue(false);
  const shine = useSharedValue(0);

  const maxX = Math.max(1, trackW - knob - MARGIN * 2);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - trackW) > 1) setTrackW(w);
  };

  const markAccepted = () => {
    setAccepted(true);
    alertConfirmSuccess();
    onAccept();
  };

  // ---- GESTE : identique à SlideToAccept ----
  const pan = Gesture.Pan()
    .enabled(!accepted && trackW > 0)
    .onBegin(() => {
      startX.value = x.value;
      tickedMid.value = false;
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(startX.value + e.translationX, 0), maxX);
      x.value = next;
      if (!tickedMid.value && next > maxX * 0.5) {
        tickedMid.value = true;
        runOnJS(alertTap)();
      }
    })
    .onEnd(() => {
      if (x.value >= maxX * 0.92) {
        x.value = withTiming(maxX, { duration: 200 });
        runOnJS(markAccepted)();
      } else {
        x.value = withSpring(0, { damping: 16 });
      }
    });

  const progress = useDerivedValue(() => x.value / maxX);

  useEffect(() => {
    if (reduceMotion) return;
    shine.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.linear }), -1, false);
  }, [reduceMotion]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const textStyle = useAnimatedStyle(() => {
    // couleur du texte sur sa propre rampe (jamais de zone de faible contraste)
    const tt = Math.min(Math.max((u.value - 0.55) / 0.22, 0), 1);
    return {
      opacity: Math.min(Math.max(1 - progress.value * 1.6, 0), 1),
      color: interpolateColor(tt, [0, 1], ['#3A2607', '#FFF4EB']),
    };
  });
  const subStyle = useAnimatedStyle(() => {
    const tt = Math.min(Math.max((u.value - 0.55) / 0.22, 0), 1);
    return {
      opacity: Math.min(Math.max(1 - progress.value * 1.6, 0), 1),
      color: interpolateColor(tt, [0, 1], ['rgba(58,38,7,0.72)', 'rgba(255,226,206,0.86)']),
    };
  });
  // crossfade dégradé jour/nuit : on anime l'opacité du calque NUIT.
  const nightStyle = useAnimatedStyle(() => ({ opacity: u.value }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shine.value, [0, 1], [-trackW * 0.4, trackW * 1.2]) },
      { skewX: '-20deg' },
    ],
    opacity: reduceMotion ? 0 : 0.34,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: 22 }]} onLayout={onLayout}>
      {/* calque JOUR (or) */}
      {trackW > 0 && (
        <View style={StyleSheet.absoluteFill}>
          <Svg width={trackW} height={height}>
            <Defs>
              <LinearGradient id="gsDay" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F8CB6D" />
                <Stop offset="1" stopColor="#D5912A" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={trackW} height={height} fill="url(#gsDay)" />
          </Svg>
        </View>
      )}
      {/* calque NUIT (braise), opacité = u */}
      {trackW > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, nightStyle]}>
          <Svg width={trackW} height={height}>
            <Defs>
              <LinearGradient id="gsNight" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FF8A3D" />
                <Stop offset="1" stopColor="#CB3A26" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={trackW} height={height} fill="url(#gsNight)" />
          </Svg>
        </Animated.View>
      )}

      {/* balayage de lumière */}
      {trackW > 0 && (
        <Animated.View pointerEvents="none" style={[styles.shine, shineStyle, { height }]} />
      )}

      {/* textes (2 lignes) */}
      <Animated.View style={styles.textWrap} pointerEvents="none">
        <Animated.Text maxFontSizeMultiplier={1.4} style={[styles.label, textStyle]}>
          {label}
        </Animated.Text>
        <Animated.Text maxFontSizeMultiplier={1.4} style={[styles.sub, subStyle]}>
          {subLabel}
        </Animated.Text>
      </Animated.View>

      {/* poignée */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.knob,
            { width: knob, height: knob, borderRadius: 18, top: MARGIN },
            knobStyle,
          ]}
        >
          {accepted ? (
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
          ) : (
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', justifyContent: 'center' },
  shine: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  textWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONT.disp, fontSize: 16.5, letterSpacing: -0.3 },
  sub: { fontFamily: FONT.disp, fontSize: 12.5, marginTop: 2 },
  knob: {
    position: 'absolute',
    left: MARGIN,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
