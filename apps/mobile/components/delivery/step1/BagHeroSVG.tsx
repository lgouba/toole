import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Polygon, Rect, G, Line } from 'react-native-svg';
import { PackageSize } from '@/types';

/**
 * Carton kraft 2.5D en SVG + reanimated (fallback OTA-safe, sans module natif).
 * Ruban adhésif vert (avant + dessus) + étiquette d'expédition. Oscillation
 * rotateY + flottement + échelle ressort. AUCUNE ombre au sol.
 */
const KRAFT_TOP = '#D7AC6E';
const KRAFT_FRONT = '#C89B5E';
const KRAFT_SIDE = '#B0844A';
const TAPE = '#16A34A';
const LABEL = '#F6F1E6';
const BARCODE = '#3A332A';

const SCALE: Record<PackageSize, number> = { small: 0.82, medium: 1.0, large: 1.18 };

export function BagHeroSVG({ size, spinning = true }: { size: PackageSize; spinning?: boolean }) {
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
          withTiming(28, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
          withTiming(-28, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
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
      <Svg width={104} height={104} viewBox="0 0 132 124">
        <G>
          {/* Faces du carton */}
          <Polygon points="30,46 54,28 110,28 86,46" fill={KRAFT_TOP} />
          <Polygon points="86,46 110,28 110,96 86,112" fill={KRAFT_SIDE} />
          <Rect x="30" y="46" width="56" height="66" fill={KRAFT_FRONT} />

          {/* Ruban adhésif vert : dessus + avant */}
          <Polygon points="50,46 66,46 90,28 74,28" fill={TAPE} />
          <Rect x="50" y="46" width="16" height="66" fill={TAPE} />

          {/* Étiquette d'expédition (avant, à droite du ruban) */}
          <Rect x="68" y="64" width="15" height="20" rx="1.5" fill={LABEL} />
          <Line x1="70" y1="78" x2="81" y2="78" stroke={BARCODE} strokeWidth={3} />
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
});
