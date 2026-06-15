import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect, Path, G, Circle, Line } from 'react-native-svg';
import { recap as R } from '@/theme/recapTokens';
import { PackageSize } from '@/types';

/**
 * Héros : sac de livraison Toolé (vert #15803D), roll-top, poche zippée +
 * passepoil gris, poignée, bretelles, wordmark "Toolé". SANS ombre au sol.
 *
 * ⚠️ RN ne fait pas de vraie 3D CSS et Lottie/expo-gl/three sont des modules
 * NATIFS (rebuild + OTA cassé). On reste donc en SVG + reanimated :
 *  - échelle ressort selon la taille (s/m/l) ;
 *  - "rotation" = oscillation rotateY douce avec perspective (illusion 3D),
 *    bornée pour que le wordmark reste lisible (pas de face arrière miroir).
 * Le vrai spin 360 volumétrique nécessiterait un build natif (expo-gl/three).
 */
const GREEN = '#15803D';
const GREEN_DK = '#0C5326';
const GREEN_SIDE = '#10692F';
const GREY = '#C3CCC5';

const SCALE: Record<PackageSize, number> = { small: 0.82, medium: 1.0, large: 1.18 };

export function BagHero({ size, spinning = true }: { size: PackageSize; spinning?: boolean }) {
  const scale = useSharedValue(SCALE[size]);
  const angle = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(SCALE[size], { damping: 12, stiffness: 170, mass: 0.6 });
  }, [size, scale]);

  useEffect(() => {
    if (spinning) {
      angle.value = withRepeat(
        withSequence(
          withTiming(26, { duration: 2300, easing: Easing.inOut(Easing.quad) }),
          withTiming(-26, { duration: 2300, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      angle.value = withTiming(0, { duration: 200 });
      float.value = 0;
    }
  }, [spinning, angle, float]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { translateY: float.value * -5 },
      { scale: scale.value },
      { rotateY: `${angle.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Svg width={116} height={128} viewBox="0 0 132 146">
        {/* Bretelles (derrière le corps) */}
        <Rect x="40" y="14" width="16" height="30" rx="7" fill={GREEN_DK} />
        <Rect x="76" y="14" width="16" height="30" rx="7" fill={GREEN_DK} />

        {/* Poignée de transport */}
        <Path d="M54 22 Q66 6 78 22" stroke={GREEN_DK} strokeWidth={7} fill="none" strokeLinecap="round" />

        {/* Roll-top (boudin enroulé) */}
        <Rect x="24" y="26" width="84" height="20" rx="10" fill={GREEN_SIDE} />
        <Rect x="24" y="24" width="84" height="16" rx="8" fill={GREEN} />

        {/* Corps du sac */}
        <Rect x="26" y="40" width="80" height="98" rx="18" fill={GREEN} />
        {/* Face latérale (3/4) pour le volume */}
        <Path d="M101 44 Q106 44 106 58 L106 122 Q106 134 99 136 L99 44 Z" fill={GREEN_SIDE} opacity={0.9} />

        {/* Passepoil vertical réfléchissant */}
        <Rect x="33" y="46" width="3" height="86" rx="1.5" fill={GREY} opacity={0.75} />
        <Rect x="96" y="46" width="3" height="86" rx="1.5" fill={GREY} opacity={0.55} />

        {/* Poche avant zippée */}
        <Rect x="42" y="64" width="48" height="58" rx="13" fill={GREEN} stroke={GREY} strokeWidth={2.4} />
        {/* Ligne de zip + tirette */}
        <Line x1="48" y1="74" x2="84" y2="74" stroke={GREEN_DK} strokeWidth={2.2} strokeLinecap="round" />
        <Circle cx="85" cy="74" r="3" fill={GREY} />

        {/* Pied */}
        <Rect x="34" y="130" width="64" height="8" rx="4" fill={GREEN_DK} opacity={0.5} />
      </Svg>

      {/* Wordmark "Toolé" (police arrondie grasse de la marque) */}
      <Text style={styles.wordmark}>Toolé</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 116, height: 128, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    position: 'absolute',
    top: 74,
    width: 116,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: R.font.displayXBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
