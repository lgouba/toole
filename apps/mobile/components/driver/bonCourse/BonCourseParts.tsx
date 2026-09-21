import React, { useState } from 'react';
import { View, Text, Pressable, LayoutChangeEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { BC, BF } from '@/theme/bonCourse';

/** Micro-libellé mono (§3). */
export function microStyle(k: number) {
  return {
    fontFamily: BF.mono,
    fontSize: Math.max(10, 10.5 * k),
    letterSpacing: 2.1 * k,
    color: BC.gris,
  } as const;
}

/** Bouton retour carré, icône seule (absolu dans son conteneur). */
export function RetourBtn({ k, g, top, onPress }: { k: number; g: number; top: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
      style={({ pressed }) => [
        { position: 'absolute', left: -8 * k, top, width: 40 * k, height: 40 * k, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name="chevron-back" size={20 * k} color={BC.encre} />
    </Pressable>
  );
}

/** Perforation en flux : pointillé SVG (largeur mesurée) + encoches aux extrémités. */
export function Perforation({ k }: { k: number }) {
  const [w, setW] = useState(0);
  const d = 15 * k;
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    if (nw && Math.abs(nw - w) > 1) setW(nw);
  };
  return (
    <View onLayout={onLayout} style={{ height: d, justifyContent: 'center' }}>
      {w > 0 ? (
        <Svg width={w} height={1} style={{ position: 'absolute', left: 0, top: d / 2 }}>
          <Line x1={0} y1={0.5} x2={w} y2={0.5} stroke={BC.filet} strokeWidth={1} strokeDasharray={`${5 * k} ${5 * k}`} />
        </Svg>
      ) : null}
      <View style={{ position: 'absolute', left: -d / 2, top: 0, width: d, height: d, borderRadius: d / 2, backgroundColor: BC.page }} />
      <View style={{ position: 'absolute', right: -d / 2, top: 0, width: d, height: d, borderRadius: d / 2, backgroundColor: BC.page }} />
    </View>
  );
}

export type EtatLigne = 'faite' | 'encours' | 'avenir';
export type LigneControle = {
  num: number;
  libelle: string;
  etat: EtatLigne;
  pourcent?: number | null;
  progress?: SharedValue<number>;
};

/** Les 4 lignes de contrôle en flux (§5.6). */
export function LignesControle({ k, lignes }: { k: number; lignes: LigneControle[] }) {
  const H = 46 * k;
  return (
    <View>
      {lignes.map((l, i) => (
        <View
          key={l.num}
          style={{ height: H, borderBottomWidth: i < lignes.length - 1 ? 1 : 0, borderColor: BC.filetFin, justifyContent: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text maxFontSizeMultiplier={1.4} style={{ width: 16 * k, fontFamily: BF.mono, fontSize: 11.5 * k, color: l.etat === 'avenir' ? BC.attente : BC.vert }}>
              {l.num}
            </Text>
            <Text
              maxFontSizeMultiplier={1.4}
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: BF.mono,
                fontSize: 11.5 * k,
                letterSpacing: 1.4 * k,
                color: l.etat === 'encours' ? BC.encre : l.etat === 'faite' ? BC.gris : BC.attente,
              }}
            >
              {l.libelle}
            </Text>
            {l.etat === 'faite' ? (
              <Ionicons name="checkmark" size={15 * k} color={BC.vert} />
            ) : l.etat === 'encours' ? (
              <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.mono, fontSize: 10.5 * k, color: BC.vert }}>
                {l.pourcent == null ? 'EN COURS' : `${l.pourcent}%`}
              </Text>
            ) : (
              <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.mono, fontSize: 11.5 * k, color: BC.attente }}>—</Text>
            )}
          </View>
          {l.etat === 'encours' && l.pourcent != null && l.progress ? <ProgressBar progress={l.progress} k={k} /> : null}
        </View>
      ))}
    </View>
  );
}

function ProgressBar({ progress, k }: { progress: SharedValue<number>; k: number }) {
  const fill = useAnimatedStyle(() => ({ width: `${Math.min(100, Math.max(0, progress.value * 100))}%` }));
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 6 * k, height: 3 * k, backgroundColor: BC.filetFin }}>
      <Animated.View style={[{ height: 3 * k, backgroundColor: BC.vert }, fill]} />
    </View>
  );
}
