import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';

/**
 * Direction « Aurora » : dégradé menthe → teal → kola qui coule derrière les
 * grands chiffres, sur fond clair. Rendu 100 % react-native-svg (aucune
 * dépendance native ajoutée). Purement décoratif — aucune logique métier.
 */

/** Nuage aurore flou (plusieurs radiaux superposés). À poser en fond, derrière du verre. */
export function AuroraGlow({
  width,
  height,
  opacity = 0.9,
  style,
}: {
  width: number;
  height: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[{ width, height, opacity }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="a1" cx="18%" cy="24%" r="55%">
            <Stop offset="0" stopColor="#9DF0CF" stopOpacity="1" />
            <Stop offset="1" stopColor="#9DF0CF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="a2" cx="80%" cy="12%" r="55%">
            <Stop offset="0" stopColor="#4FD3C4" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#4FD3C4" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="a3" cx="55%" cy="70%" r="65%">
            <Stop offset="0" stopColor="#7BE0A6" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#7BE0A6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="a4" cx="95%" cy="55%" r="50%">
            <Stop offset="0" stopColor="#BDEECB" stopOpacity="0.8" />
            <Stop offset="1" stopColor="#BDEECB" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#a1)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#a2)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#a3)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#a4)" />
      </Svg>
    </View>
  );
}

/**
 * Texte à remplissage dégradé Aurora (menthe → kola). Idéal pour un chiffre/code
 * COURT et de largeur connue (le SVG a besoin d'une boîte). `width`/`height`
 * dimensionnent la boîte ; `fontSize`/`fontFamily`/`align` pilotent le glyphe.
 */
export function AuroraText({
  children,
  width,
  height,
  fontSize,
  fontFamily,
  align = 'left',
  letterSpacing = 0,
  id,
}: {
  children: string;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  align?: 'left' | 'right' | 'center';
  letterSpacing?: number;
  /** id unique du gradient (obligatoire si plusieurs AuroraText sur l'écran). */
  id: string;
}) {
  const x = align === 'left' ? 0 : align === 'right' ? width : width / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.7">
          <Stop offset="0" stopColor="#0E7A44" />
          <Stop offset="0.5" stopColor="#12B58A" />
          <Stop offset="1" stopColor="#2CC6A0" />
        </LinearGradient>
      </Defs>
      <SvgText
        x={x}
        y={height * 0.8}
        fill={`url(#${id})`}
        fontSize={fontSize}
        fontWeight="800"
        fontFamily={fontFamily}
        textAnchor={anchor}
        letterSpacing={letterSpacing}
      >
        {children}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({});
