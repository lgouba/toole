import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  LayoutChangeEvent,
  AccessibilityInfo,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Line,
  Circle,
  Ellipse,
  G,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { authColors as C } from '@/theme/auth';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const VB_W = 480;
const VB_H = 360;

// Asset livreur 3D Tôllé (exporté en 1x/2x/3x). RN choisit la densité.
const RIDER = require('@/assets/images/rider/rider.png');

// Blocs de ville (x, y, w, h) — décor statique.
const CITY_BLOCKS: [number, number, number, number][] = [
  [30, 44, 96, 74], [146, 34, 78, 98], [244, 54, 98, 70], [362, 38, 92, 94],
  [26, 150, 82, 90], [128, 164, 104, 78], [252, 150, 78, 92], [350, 164, 100, 80],
  [40, 266, 100, 74], [164, 270, 84, 72], [272, 266, 100, 74], [392, 270, 74, 70],
];

// Route de livraison A→B.
// Le livreur (asset 3D) regarde vers la GAUCHE : on place donc le DÉPART à
// droite et l'ARRIVÉE à gauche, pour qu'il roule bien dans le sens où il
// regarde, vers l'anneau de destination. (Retourner l'asset inverserait le
// logo "Toolé" du sac → exclu.)
// Le point bas de la route passe SOUS les roues du livreur (~x185, y262) pour
// qu'il paraisse posé sur la route, puis remonte vers l'arrivée en haut-gauche.
const START = { x: 432, y: 296 }; // point de départ (pulse), bas-droite
const DEST = { x: 66, y: 208 }; // anneau d'arrivée (pin), gauche
// La route reste à hauteur des roues (~y260) sur TOUTE la largeur du livreur
// (x ~250 → ~125), puis remonte vers le pin. Ainsi les 2 roues touchent la
// ligne au lieu que la roue avant flotte au-dessus.
const ROUTE = `M${START.x} ${START.y} C 360 290, 285 263, 250 261 C 200 258, 160 261, 125 259 C 100 257, 80 234, ${DEST.x} ${DEST.y}`;

export function DeliveryHero() {
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = width / VB_W;
  const height = width * (VB_H / VB_W);

  // ---- shared values ----
  const ride = useSharedValue(0); // 0..1 cycle du livreur
  const dash = useSharedValue(0); // défilement route
  const bitume = useSharedValue(0); // défilement sol
  const pulse = useSharedValue(0); // point de départ A
  const bob = useSharedValue(0); // oscillation pin/bulle
  const enter = useSharedValue(0); // fadeIn livreur

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!mounted) return;
      setReduceMotion(rm);
      if (rm) {
        // état statique propre
        enter.value = 1;
        return;
      }
      enter.value = withDelay(250, withTiming(1, { duration: 900 }));
      ride.value = withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      dash.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
      bitume.value = withRepeat(withTiming(1, { duration: 460, easing: Easing.linear }), -1, false);
      pulse.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      bob.value = withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - width) > 1) setWidth(w);
  };

  // ---- route verte qui défile (flux vers B) ----
  const routeProps = useAnimatedProps(() => ({
    strokeDashoffset: -dash.value * 40,
  }));

  // ---- bitume défilant sous les roues ----
  const bitume1Props = useAnimatedProps(() => ({
    strokeDashoffset: -bitume.value * 22,
  }));
  const bitume2Props = useAnimatedProps(() => ({
    strokeDashoffset: -bitume.value * 22,
  }));

  // ---- livreur : tangage + montée + drift + fadeIn ----
  const riderStyle = useAnimatedStyle(() => {
    const rot = interpolate(ride.value, [0, 1], [-1.8, 2]); // degrés
    const ty = interpolate(ride.value, [0, 0.5, 1], [0, -11, 0]);
    const tx = interpolate(ride.value, [0, 0.5, 1], [-3, 4, -3]);
    return {
      opacity: enter.value,
      transform: [{ translateX: tx }, { translateY: ty }, { rotateZ: `${rot}deg` }],
    };
  });

  // ---- ombre au sol qui respire (synchro ride) ----
  const shadowStyle = useAnimatedStyle(() => {
    const s = interpolate(ride.value, [0, 0.5, 1], [1, 0.8, 1]);
    const op = interpolate(ride.value, [0, 0.5, 1], [0.14, 0.06, 0.14]);
    return { transform: [{ scaleX: s }], opacity: op };
  });

  // ---- point A : pulse ----
  const pulseStyle = useAnimatedStyle(() => {
    const s = interpolate(pulse.value, [0, 0.5, 1], [1, 1.8, 1]);
    const op = interpolate(pulse.value, [0, 0.5, 1], [0.18, 0.05, 0.18]);
    return { transform: [{ scale: s }], opacity: op };
  });

  // ---- pin + bulle ETA : bob vertical ----
  const bobStyle = useAnimatedStyle(() => {
    const ty = interpolate(bob.value, [0, 0.5, 1], [0, -5, 0]);
    return { transform: [{ translateY: ty }] };
  });

  // Convertit une coordonnée viewBox -> px écran.
  const px = (v: number) => v * scale;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && (
        <>
          {/* ===== CARTE (SVG) ===== */}
          <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Defs>
              <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#EEF2F6" />
                <Stop offset="1" stopColor="#FFFFFF" />
              </LinearGradient>
            </Defs>

            <Rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#bg)" />

            {/* blocs de ville */}
            {CITY_BLOCKS.map(([x, y, w, h], i) => (
              <Rect key={i} x={x} y={y} width={w} height={h} rx={14} fill={C.cityBlock} />
            ))}
            {/* accents parc + eau */}
            <Rect x={244} y={54} width={98} height={70} rx={14} fill={C.park} />
            <Rect x={40} y={266} width={100} height={74} rx={14} fill={C.water} />

            {/* routes blanches */}
            {['M0 138 H480', 'M0 254 H480', 'M138 0 V360', 'M236 0 V360', 'M352 0 V360'].map(
              (d, i) => (
                <Path key={i} d={d} stroke={C.road} strokeWidth={7} strokeLinecap="round" />
              ),
            )}

            {/* route de livraison : fantôme + vert animé */}
            <Path d={ROUTE} stroke={C.routeGhost} strokeWidth={6} fill="none" strokeLinecap="round" />
            <AnimatedPath
              d={ROUTE}
              stroke={C.primary}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="10 12"
              animatedProps={routeProps}
            />

            {/* point de départ A — coeur statique (halo animé en overlay) */}
            <Circle cx={START.x} cy={START.y} r={9} fill="#fff" stroke={C.primary} strokeWidth={3} />
            <Circle cx={START.x} cy={START.y} r={3.5} fill={C.primary} />
          </Svg>

          {/* ===== Halo pulsant du point de départ (overlay) ===== */}
          <Animated.View
            style={[
              styles.pulse,
              {
                left: px(START.x) - px(16),
                top: px(START.y) - px(16),
                width: px(32),
                height: px(32),
                borderRadius: px(16),
              },
              pulseStyle,
            ]}
          />

          {/* ===== Pin de destination (overlay, bob) — sans bulle ETA ===== */}
          <Animated.View
            style={[styles.pinWrap, { left: px(DEST.x), top: px(DEST.y) }, bobStyle]}
          >
            <Svg width={px(40)} height={px(48)} viewBox="0 0 40 48" style={{ marginLeft: px(-20), marginTop: px(-44) }}>
              <Ellipse cx={20} cy={44} rx={12} ry={3.5} fill="#0f172a" opacity={0.1} />
              <Path
                d="M20 2 C10 2 4 9 4 18 C4 30 20 44 20 44 C20 44 36 30 36 18 C36 9 30 2 20 2 Z"
                fill={C.primary}
              />
              <Circle cx={20} cy={17} r={7.5} fill="#fff" />
              <Path d="M16 17 l3 3 l6 -6" stroke={C.primary} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>

          {/* ===== Bitume défilant sous les roues ===== */}
          <View style={[styles.bitume, { left: 0, top: 0, width, height }]} pointerEvents="none">
            <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
              <G opacity={0.6}>
                <AnimatedLine
                  x1={116} y1={267} x2={252} y2={267}
                  stroke="#cbd5e1" strokeWidth={3.4} strokeDasharray="9 13"
                  animatedProps={bitume1Props}
                />
                <AnimatedLine
                  x1={126} y1={259} x2={242} y2={259}
                  stroke="#dbe3ec" strokeWidth={2.6} strokeDasharray="7 15"
                  animatedProps={bitume2Props}
                />
              </G>
            </Svg>
          </View>

          {/* ===== Ombre au sol du livreur ===== */}
          <Animated.View
            style={[
              styles.riderShadow,
              {
                left: px(180) - px(56),
                top: px(263) - px(8),
                width: px(112),
                height: px(16),
                borderRadius: px(56),
              },
              shadowStyle,
            ]}
          />

          {/* ===== Livreur 3D ===== */}
          <Animated.View
            style={[
              styles.riderWrap,
              { left: px(122), top: px(103), width: px(116), height: px(160) },
              riderStyle,
            ]}
          >
            <Image source={RIDER} style={styles.riderImg} resizeMode="contain" />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: VB_W / VB_H,
    position: 'relative',
    overflow: 'hidden',
  },
  pulse: {
    position: 'absolute',
    backgroundColor: '#00C853',
  },
  pinWrap: {
    position: 'absolute',
  },
  bitume: { position: 'absolute' },
  riderShadow: {
    position: 'absolute',
    backgroundColor: '#0f172a',
  },
  riderWrap: {
    position: 'absolute',
    transformOrigin: 'bottom center',
  },
  riderImg: { width: '100%', height: '100%' },
});
