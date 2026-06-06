import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

// Héros : illustration complète (carte + itinéraire + livreur déjà posé sur la
// route). Tout est cuit dans l'image → aucun problème d'alignement. On ajoute
// juste une légère animation flottante pour donner de la vie.
const HERO = require('@/assets/images/hero/hero-map.png');
const RATIO = 1200 / 896;

export function DeliveryHero() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const float = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!mounted) return;
      setReduceMotion(rm);
      if (rm) return;
      float.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * float.value }, // monte/descend légèrement
      { scale: 1 + 0.012 * float.value }, // respire à peine
    ],
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.imgWrap, reduceMotion ? undefined : style]}>
        <Image source={HERO} style={styles.img} resizeMode="cover" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: RATIO,
    overflow: 'hidden',
    backgroundColor: '#EAF0EE', // teinte de la carte (évite le flash blanc au chargement)
  },
  imgWrap: { flex: 1 },
  img: { width: '100%', height: '100%' },
});
