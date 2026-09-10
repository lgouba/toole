import React, { useEffect, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  AccessibilityInfo,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { PackageSize } from '@/types';
import {
  BOXES,
  BoxSpec,
  GROUND,
  SCENE_VIEWBOX,
  SCENE_VB_W,
  SCENE_VB_H,
  SCENE_VB_Y,
} from './parcelGeometry';
import { IsoParcel } from './IsoParcel';

const VB_W = SCENE_VB_W;
const VB_H = SCENE_VB_H;
const VB_Y = SCENE_VB_Y;

// Courbe à léger dépassement (spec) pour l'échelle + le décalage.
const OVERSHOOT = Easing.bezier(0.34, 1.5, 0.64, 1);

interface Props {
  value: PackageSize;
  onChange: (s: PackageSize) => void;
  sizes: readonly { key: PackageSize; name: string; weight: string }[];
}

/** Un carton animé (scale/opacity/décalage) autour de sa base (cx, GROUND). */
function AnimatedCarton({
  box,
  selected,
  reduceMotion,
  sceneW,
  sceneH,
}: {
  box: BoxSpec;
  selected: boolean;
  reduceMotion: boolean;
  sceneW: number;
  sceneH: number;
}) {
  // Origine de transformation = base du carton, en coords écran.
  // La fenêtre viewBox commence à y=VB_Y : on soustrait cet offset pour mapper
  // une coordonnée monde -> écran.
  const ox = (box.cx / VB_W) * sceneW;
  const oy = ((GROUND - VB_Y) / VB_H) * sceneH;
  const dyScreen = (10 / VB_H) * sceneH; // décalage +10 (unités viewBox) -> écran

  const sv = useSharedValue(selected ? 1 : 0); // échelle + décalage (overshoot)
  const ov = useSharedValue(selected ? 1 : 0); // opacité (linéaire)

  useEffect(() => {
    if (reduceMotion) {
      sv.value = selected ? 1 : 0;
      ov.value = selected ? 1 : 0;
      return;
    }
    sv.value = withTiming(selected ? 1 : 0, { duration: 550, easing: OVERSHOOT });
    ov.value = withTiming(selected ? 1 : 0, { duration: 400, easing: Easing.linear });
  }, [selected, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const scale = 0.92 + sv.value * 0.15; // 0.92 -> 1.07
    const dy = (1 - sv.value) * dyScreen; // non sélectionné : +décalage
    return {
      opacity: 0.46 + ov.value * 0.54, // 0.46 -> 1
      transform: [
        { translateX: ox },
        { translateY: oy + dy },
        { scale },
        { translateX: -ox },
        { translateY: -oy },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={sceneW} height={sceneH} viewBox={SCENE_VIEWBOX}>
        <IsoParcel box={box} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Scène des 3 cartons isométriques. Le SVG des cartons est décoratif ; le contrôle
 * exposé au lecteur d'écran est CE radiogroup (le segmenté de SizeStage est masqué
 * de l'arbre d'a11y, cf. compte rendu) -> le lecteur annonce 3 options, pas 6.
 */
export function ParcelScene({ value, onChange, sizes }: Props) {
  const [w, setW] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const h = w * (VB_H / VB_W);

  const nameOf = (k: PackageSize) => sizes.find((s) => s.key === k)?.name ?? k;
  const weightOf = (k: PackageSize) => sizes.find((s) => s.key === k)?.weight ?? '';

  return (
    <View>
      <View style={styles.scene} onLayout={onLayout} accessibilityRole="radiogroup">
        {w > 0 ? (
          <>
            {/* Fond + ligne de sol (dessiné une fois) */}
            <Svg width={w} height={h} viewBox={SCENE_VIEWBOX} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="scene-bg" cx="0.5" cy="0.22" rx="0.84" ry="0.66">
                  <Stop offset="0" stopColor="#FFFFFF" />
                  <Stop offset="0.6" stopColor="#F6F0DE" />
                  <Stop offset="1" stopColor="#EBE2CA" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y={VB_Y} width={VB_W} height={VB_H} fill="url(#scene-bg)" />
              <Line x1="18" y1="236" x2="332" y2="236" stroke="#DFD4B7" strokeWidth={1.3} />
            </Svg>

            {/* Cartons animés (arrière -> avant pour un recouvrement correct) */}
            {BOXES.map((box) => (
              <AnimatedCarton
                key={box.key}
                box={box}
                selected={box.key === value}
                reduceMotion={reduceMotion}
                sceneW={w}
                sceneH={h}
              />
            ))}

            {/* Zones tactiles (radios) — 3 colonnes couvrant chaque carton */}
            <View style={styles.tapRow} pointerEvents="box-none">
              {BOXES.map((box) => {
                const active = box.key === value;
                return (
                  <Pressable
                    key={box.key}
                    style={styles.tapCol}
                    onPress={() => onChange(box.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`${nameOf(box.key)}, ${weightOf(box.key)}`}
                    hitSlop={6}
                  />
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    width: '100%',
    aspectRatio: VB_W / VB_H,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F6F0DE',
  },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapCol: { flex: 1 },
});
