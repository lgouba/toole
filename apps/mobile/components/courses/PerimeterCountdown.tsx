import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  interpolateColor,
  SharedValue,
} from 'react-native-reanimated';
import { T } from './theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Trait périmétrique animé qui fait tout le tour de l'écran et se vide au rythme
 * du compte à rebours. La couleur interpole sur la progression :
 * vert → ambre → orange → rouge (urgence croissante).
 *
 * `progress` (0→1) est piloté par le parent (même valeur que la pastille
 * secondes) pour que tout reste parfaitement synchrone.
 */
export function PerimeterCountdown({ progress }: { progress: SharedValue<number> }) {
  const { width: W, height: H } = useWindowDimensions();
  // Inset généreux : à 5px le trait passait sous les coins arrondis / la
  // courbure du bord de l'écran et devenait invisible. ~16px le rend net.
  const inset = 16;
  const r = 34;
  const w = W - inset * 2;
  const h = H - inset * 2;

  // Périmètre du rect arrondi : segments droits + 4 quarts de cercle.
  const straight = (w - 2 * r) * 2 + (h - 2 * r) * 2;
  const corners = 2 * Math.PI * r;
  const perimeter = straight + corners;

  const animatedProps = useAnimatedProps(() => ({
    // se vide : l'offset croît avec la progression
    strokeDashoffset: progress.value * perimeter,
    stroke: interpolateColor(
      progress.value,
      [0, 0.55, 0.82, 1],
      [T.vivid, T.amber, T.orange, T.red],
    ),
  }));

  return (
    <Svg style={StyleSheet.absoluteFill} width={W} height={H} pointerEvents="none">
      <AnimatedRect
        x={inset}
        y={inset}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill="none"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={perimeter}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
