import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, AccessibilityInfo, useWindowDimensions } from 'react-native';
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
 * Android 12+ n'autorise pas une image plein écran en splash natif. Ce
 * composant affiche le hero en plein écran sur les 2 plateformes, puis se fond.
 *
 * ⚠️ Dimensions EXPLICITES (taille de l'écran) : on ne s'appuie pas sur
 * StyleSheet.absoluteFill, car selon l'arbre de providers le parent peut ne pas
 * être plein écran → le cover se calculait sur une boîte trop petite et zoomait
 * l'image. En forçant width/height = écran, le cover est exact (hero entier).
 */
const HERO = require('@/assets/images/toole-splash.png');
const BG_GREEN = '#0F5132';
const HOLD_MS = 1400;

export function AppSplash({ onHidden }: { onHidden: () => void }) {
  const { width, height } = useWindowDimensions();
  const opacity = useSharedValue(1);
  const reduceMotion = useRef(false);
  const hidNative = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      reduceMotion.current = rm;
    });
  }, []);

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
      style={[
        { position: 'absolute', top: 0, left: 0, width, height, backgroundColor: BG_GREEN, zIndex: 9999 },
        style,
      ]}
      onLayout={onLayout}
    >
      <Image source={HERO} style={{ width, height }} resizeMode="cover" />
    </Animated.View>
  );
}
