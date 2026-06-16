import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { driverHome as D } from '@/theme/recapTokens';

/**
 * Voile crème radial par-dessus la carte : opaque au centre (lisibilité du
 * cadran/textes), transparent sur les bords (la carte/les rues restent visibles).
 *
 * IMPORTANT : enveloppé dans une <View pointerEvents="none"> — sur react-native-svg,
 * `pointerEvents="none"` posé directement sur <Svg> ne laisse PAS toujours passer
 * les taps, ce qui bloquait les boutons zoom +/- de la carte. La View, elle, est
 * fiable et laisse tous les taps atteindre la carte dessous.
 */
export function MapScrim() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="scrim" cx="50%" cy="42%" rx="75%" ry="62%">
            <Stop offset="0%" stopColor={D.canvas} stopOpacity={1} />
            <Stop offset="42%" stopColor={D.canvas} stopOpacity={0.7} />
            <Stop offset="80%" stopColor={D.canvas} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#scrim)" />
      </Svg>
    </View>
  );
}
