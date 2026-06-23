import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { C, F } from './tokens';

interface CancelCountdownProps {
  /** Secondes restantes dans la fenêtre d'annulation. */
  secondsLeft: number;
  onPress: () => void;
  /** Coupe le clignotement du point (prefers-reduced-motion). */
  reduceMotion?: boolean;
}

/**
 * Pavé sombre « Annuler la course » (variante C) : icône croix ambre, libellé,
 * et badge ambre avec point clignotant + compte à rebours (Space Grotesk).
 * À n'afficher que pendant la fenêtre d'annulation (avant récupération du colis).
 */
export function CancelCountdown({
  secondsLeft,
  onPress,
  reduceMotion,
}: CancelCountdownProps) {
  const blink = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      blink.value = 1;
      return;
    }
    blink.value = withRepeat(
      withTiming(0.25, { duration: 500, easing: Easing.steps(2, true) }),
      -1,
      true,
    );
  }, [reduceMotion]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <TouchableOpacity style={styles.cancel} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.lft}>
        <View style={styles.x}>
          <Ionicons name="close" size={16} color={C.amberText} />
        </View>
        <View>
          <Text style={styles.title}>Annuler la course</Text>
          <Text style={styles.sub}>fenêtre d'annulation</Text>
        </View>
      </View>
      <View style={styles.cd}>
        <Animated.View style={[styles.dot, dotStyle]} />
        <Text style={styles.cdText}>{secondsLeft} s</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cancel: {
    backgroundColor: C.dark,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  x: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(232,135,10,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontFamily: F.uiBold, fontSize: 14 },
  sub: { color: 'rgba(255,255,255,0.5)', fontFamily: F.ui, fontSize: 11, marginTop: 1 },
  cd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(232,135,10,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(232,135,10,0.4)',
    borderRadius: 30,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.amber },
  cdText: { fontFamily: F.display, fontSize: 13, color: C.amberText },
});
