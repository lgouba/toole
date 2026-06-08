import React, { useEffect } from 'react';
import { StyleSheet, TextInput, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Formatte un nombre avec un espace tous les 3 chiffres (worklet-safe). */
function fmt(n: number) {
  'worklet';
  const s = String(Math.round(n));
  let out = '';
  let c = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    out = s[i] + out;
    c++;
    if (c % 3 === 0 && i > 0) out = ' ' + out;
  }
  return out;
}

/**
 * Montant du gain qui s'incrémente de 0 → `value` à l'ouverture (1100ms,
 * cubic-out). Technique compteur Reanimated : on anime la prop `text` d'un
 * <TextInput> non éditable, sans re-render React.
 */
export function GainCounter({
  value,
  style,
  reduceMotion,
}: {
  value: number;
  style?: TextStyle | TextStyle[];
  reduceMotion: boolean;
}) {
  const v = useSharedValue(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      v.value = value;
      return;
    }
    v.value = 0;
    v.value = withTiming(value, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [value, reduceMotion]);

  const animatedProps = useAnimatedProps(() => {
    return { text: fmt(v.value) } as any;
  });

  return (
    <AnimatedTextInput
      style={[styles.input, style]}
      editable={false}
      // valeur initiale (avant que l'animation prenne la main)
      defaultValue={fmt(reduceMotion ? value : 0)}
      animatedProps={animatedProps}
      // empêche toute interaction / curseur
      pointerEvents="none"
      caretHidden
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
  },
});
