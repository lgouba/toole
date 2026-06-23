import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { C, F } from './tokens';

interface DriverHoodProps {
  /** Hauteur du bandeau (340 par défaut pour le mode adresse, ~188-248 pour le mode personne). */
  height?: number;
  /** Étape courante 1..4 → « ÉTAPE n/4 » (Space Mono). */
  step?: number;
  onBack?: () => void;
  children: ReactNode;
}

/**
 * Bandeau hero plein-largeur à dégradé vert (modèle C). Porte le bouton retour
 * (pastille translucide), l'indicateur d'étape et le contenu clé de l'écran.
 * Dégradé rendu via react-native-svg (pas de dépendance native carte/gradient).
 */
export function DriverHood({ height = 340, step, onBack, children }: DriverHoodProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hood, { height }]}>
      <StatusBar style="light" />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="hoodGrad" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={C.gradFrom} />
            <Stop offset="0.55" stopColor={C.gradMid} />
            <Stop offset="1" stopColor={C.gradTo} />
          </LinearGradient>
          <RadialGradient id="hoodHalo" cx="0.85" cy="0.08" r="0.55">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hoodGrad)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hoodHalo)" />
      </Svg>

      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        {onBack ? (
          <TouchableOpacity
            style={styles.back}
            onPress={onBack}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 42 }} />
        )}
        {step != null && <Text style={styles.step}>ÉTAPE {step}/4</Text>}
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hood: {
    backgroundColor: C.gradFrom,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    fontFamily: F.mono,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.72)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
});
