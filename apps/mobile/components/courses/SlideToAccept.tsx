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
  withDelay,
  interpolate,
  runOnJS,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { T, FONT, RAD } from './theme';
import { alertConfirmSuccess, alertTap } from '@/utils/alerts';

const TRACK_H = 64;
const KNOB_W = 46;
const KNOB_H = 52;
const MARGIN = 6;

/**
 * Glisser-pour-accepter. La poignée (rectangle à 3 barres) suit le doigt, le
 * remplissage vert avance, le texte s'efface. Relâché avant 92% → retour ;
 * au bout → succès (✓, haptique, onAccept), geste désactivé.
 */
export function SlideToAccept({
  label,
  onAccept,
  reduceMotion,
}: {
  label: string;
  onAccept: () => void;
  reduceMotion: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const tickedMid = useSharedValue(false);

  const maxX = Math.max(1, trackW - KNOB_W - MARGIN * 2);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - trackW) > 1) setTrackW(w);
  };

  const markAccepted = () => {
    setAccepted(true);
    alertConfirmSuccess();
    onAccept();
  };

  const pan = Gesture.Pan()
    .enabled(!accepted && trackW > 0)
    .onBegin(() => {
      startX.value = x.value;
      tickedMid.value = false;
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(startX.value + e.translationX, 0), maxX);
      x.value = next;
      // petit tick haptique à mi-course
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

  // progression 0→1
  const progress = useDerivedValue(() => x.value / maxX);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: MARGIN + x.value + KNOB_W / 2,
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(1 - progress.value * 1.5, 0), 1),
  }));

  // chevrons animés (off si reduce motion)
  const chev = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    chev.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [reduceMotion]);

  return (
    <View style={styles.track} onLayout={onLayout}>
      {/* remplissage dégradé deepA → vivid */}
      <Animated.View style={[styles.fill, fillStyle]}>
        {trackW > 0 && (
          <Svg width={trackW} height={TRACK_H}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={T.deepA} />
                <Stop offset="1" stopColor={T.vivid} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={trackW} height={TRACK_H} fill="url(#fill)" />
          </Svg>
        )}
      </Animated.View>

      {/* texte + chevrons */}
      <Animated.View style={[styles.textRow, textStyle]} pointerEvents="none">
        <Text style={styles.text}>{label}</Text>
        <View style={styles.chevrons}>
          {[0, 1, 2].map((i) => (
            <Chevron key={i} index={i} chev={chev} reduceMotion={reduceMotion} />
          ))}
        </View>
      </Animated.View>

      {/* poignée */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, knobStyle]}>
          <Svg style={StyleSheet.absoluteFill} width={KNOB_W} height={KNOB_H}>
            <Defs>
              <LinearGradient id="knob" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="1" stopColor="#EEF5F0" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={KNOB_W} height={KNOB_H} rx={RAD.knob} fill="url(#knob)" />
          </Svg>
          {accepted ? (
            <Ionicons name="checkmark" size={26} color={T.knobInk} />
          ) : (
            <View style={styles.bars}>
              <View style={styles.bar} />
              <View style={styles.bar} />
              <View style={styles.bar} />
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Chevron({
  index,
  chev,
  reduceMotion,
}: {
  index: number;
  chev: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.6 };
    // cycle décalé par index
    const p = (chev.value + index * 0.15) % 1;
    return { opacity: interpolate(p, [0, 0.5, 1], [0.3, 1, 0.3]) };
  });
  return <Animated.View style={[styles.chevron, style]} />;
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: RAD.track,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  textRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 40,
    gap: 8,
  },
  text: { fontFamily: FONT.dispBold, fontSize: 15, color: '#DFF3E7' },
  chevrons: { flexDirection: 'row', gap: 3 },
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#9AF2C1',
    transform: [{ rotate: '45deg' }],
  },
  knob: {
    position: 'absolute',
    left: MARGIN,
    top: MARGIN,
    width: KNOB_W,
    height: KNOB_H,
    borderRadius: RAD.knob,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { width: 3, height: 18, borderRadius: 2, backgroundColor: T.knobInk },
});
