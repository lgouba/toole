import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { driverHome as D } from '@/theme/recapTokens';

/**
 * Voile crème radial par-dessus la carte : opaque au centre (lisibilité du
 * cadran/textes), transparent sur les bords (la carte/les rues restent visibles).
 * Non-interactif (la carte dessous reste pan/zoom).
 */
export function MapScrim() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="scrim" cx="50%" cy="42%" rx="75%" ry="62%">
          <Stop offset="0%" stopColor={D.canvas} stopOpacity={1} />
          <Stop offset="42%" stopColor={D.canvas} stopOpacity={0.7} />
          <Stop offset="80%" stopColor={D.canvas} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#scrim)" />
    </Svg>
  );
}
