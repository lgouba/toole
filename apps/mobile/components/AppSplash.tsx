import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, AccessibilityInfo } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

/**
 * Splash hero plein écran (JS) — identique iOS/Android.
 *
 * Android 12+ n'autorise pas une image plein écran en splash natif (icône
 * imposée par l'OS). Ce composant, monté par-dessus l'app, affiche le hero en
 * plein écran sur les 2 plateformes, puis se fond.
 *
 * Couleur de fond = EXACTEMENT le vert du hero (#0F5132), identique au
 * backgroundColor du splash natif → la bascule natif→JS est invisible (pas de
 * flash blanc, pas de saut de couleur).
 */
const HERO = require('@/assets/images/toole-splash.png');
const BG_GREEN = '#0F5132';
const HOLD_MS = 1400;

export function AppSplash({ onHidden }: { onHidden: () => void }) {
  const opacity = useSharedValue(1);
  const reduceMotion = useRef(false);
  const hidNative = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      reduceMotion.current = rm;
    });
  }, []);

  // Au 1er layout du splash JS → on cache le splash natif. À ce moment le fond
  // vert est déjà peint (identique au natif) → aucun flash.
  const onLayout = () => {
    if (hidNative.current) return;
    hidNative.current = true;
    SplashScreen.hideAsync().catch(() => {});

    setTimeout(() => {
      if (reduceMotion.current) {
        onHidden();
        return;
      }
      opacity.value = withTiming(
        0,
        { duration: 400, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(onHidden)();
        },
      );
    }, HOLD_MS);
  };

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, style]}
      onLayout={onLayout}
    >
      <Image source={HERO} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: BG_GREEN, zIndex: 9999 },
});
